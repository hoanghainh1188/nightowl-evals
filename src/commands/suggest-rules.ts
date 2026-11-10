import { open, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { AGENT_IDS, isAnyAgentId } from '../agents/ids.js';
import { errorMessage } from '../cli/errors.js';
import { renderCommandHelp } from '../cli/help.js';
import type { Io } from '../cli/io.js';
import { CATEGORIES } from '../classify/prompt.js';
import {
  ANTHROPIC_API_HOST,
  ANTHROPIC_API_KEY_ENV,
  type RunAnthropicApi,
  resolveApiModel,
  runAnthropicApi,
} from '../classify/run-api.js';
import { type RunClaude, runClaude } from '../classify/run-claude.js';
import { UNCLASSIFIED } from '../report/build.js';
import { formatSuggestedRules, hasRulesMarker } from '../rules/format.js';
import { buildHeuristicRules } from '../rules/heuristic.js';
import { enrichRulesWithLlm, type RulesLlmDeps, type RulesTransport } from '../rules/llm.js';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_MIN_COUNT,
  DEFAULT_STATUSES,
  type FailureStatus,
  RULES_MARKER,
} from '../rules/types.js';
import { isSymlink, writeFileAtomic } from '../setup/fs-utils.js';
import { parseDateOption } from '../shared/date-option.js';
import { printable } from '../shared/printable.js';
import type { Command } from './command.js';
import { DEFAULT_MODEL, MODEL_NAME } from './classify.js';
import { openExistingStore } from './existing-store.js';

const CATEGORY_NAMES = new Set([...Object.keys(CATEGORIES), UNCLASSIFIED]);
const STATUSES: readonly FailureStatus[] = ['flagged', 'confirmed', 'dismissed'];
const MAX_LIMIT = 50;
const MAX_MIN_COUNT = 100;

export interface SuggestRulesDeps {
  readonly cwd: () => string;
  readonly runClaude: RunClaude;
  readonly runApi: RunAnthropicApi;
  readonly env: () => NodeJS.ProcessEnv;
  readonly now: () => Date;
}

const defaultDeps: SuggestRulesDeps = {
  cwd: () => process.cwd(),
  runClaude,
  runApi: runAnthropicApi,
  env: () => process.env,
  now: () => new Date(),
};

interface Options {
  readonly since: string | null;
  readonly categories: readonly string[];
  readonly agents: readonly string[] | null;
  readonly statuses: readonly FailureStatus[];
  readonly output: string | null;
  readonly force: boolean;
  readonly minCount: number;
  readonly limit: number;
  readonly yes: boolean;
  readonly model: string;
  readonly transport: RulesTransport;
}

function parseOptions(args: readonly string[]): Options | string {
  let values;
  try {
    values = parseArgs({
      args: [...args],
      options: {
        since: { type: 'string' },
        category: { type: 'string', multiple: true },
        agent: { type: 'string', multiple: true },
        status: { type: 'string', multiple: true },
        output: { type: 'string' },
        write: { type: 'string' },
        force: { type: 'boolean' },
        'min-count': { type: 'string' },
        limit: { type: 'string' },
        yes: { type: 'boolean' },
        model: { type: 'string' },
        transport: { type: 'string' },
      },
      strict: true,
      allowPositionals: false,
    }).values;
  } catch (error) {
    return errorMessage(error);
  }

  if (values.output !== undefined && values.write !== undefined) return 'use either --output or --write, not both';
  const outputRaw = values.output ?? values.write;
  if (outputRaw === '') return '--output needs a file path';

  const since = values.since === undefined ? null : parseDateOption(values.since);
  if (since === null && values.since !== undefined) return `invalid --since date (use YYYY-MM-DD): ${values.since}`;

  const categories = values.category ?? [...DEFAULT_CATEGORIES];
  const unknownCategory = categories.find((name) => !CATEGORY_NAMES.has(name));
  if (unknownCategory !== undefined) {
    return `unknown --category: ${unknownCategory} (use one of ${[...CATEGORY_NAMES].join(', ')})`;
  }

  const agentFlags = values.agent ?? [];
  for (const id of agentFlags) {
    if (!isAnyAgentId(id)) return `unknown --agent id: ${id} (known: ${AGENT_IDS.join(', ')}, unknown)`;
  }

  const statusFlags = values.status ?? [...DEFAULT_STATUSES];
  for (const status of statusFlags) {
    if (!STATUSES.includes(status as FailureStatus)) {
      return `--status must be one of ${STATUSES.join(', ')}`;
    }
  }

  const minCount =
    values['min-count'] === undefined ? DEFAULT_MIN_COUNT : Number(values['min-count']);
  if (!Number.isInteger(minCount) || minCount < 1 || minCount > MAX_MIN_COUNT) {
    return `--min-count must be a whole number from 1 to ${MAX_MIN_COUNT}`;
  }

  const limit = values.limit === undefined ? 20 : Number(values.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return `--limit must be a whole number from 1 to ${MAX_LIMIT}`;
  }

  const model = values.model ?? DEFAULT_MODEL;
  if (!MODEL_NAME.test(model)) return `invalid --model: ${model}`;

  const transportRaw = values.transport ?? 'cli';
  if (transportRaw !== 'cli' && transportRaw !== 'api') return '--transport must be cli or api';

  return {
    since,
    categories,
    agents: agentFlags.length === 0 ? null : agentFlags,
    statuses: statusFlags as FailureStatus[],
    output: outputRaw ?? null,
    force: values.force === true,
    minCount,
    limit,
    yes: values.yes === true,
    model,
    transport: transportRaw,
  };
}

async function isReplaceable(path: string): Promise<boolean> {
  const handle = await open(path, 'r').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (handle === null) return true;
  try {
    if (!(await handle.stat()).isFile()) return false;
    const content = await readFile(path, 'utf8');
    return content.trim() === '' || hasRulesMarker(content);
  } finally {
    await handle.close();
  }
}

async function writeOutput(path: string, content: string, force: boolean, cwd: string, io: Io): Promise<void> {
  const target = resolve(cwd, path);
  const shown = printable(target);
  if (await isSymlink(target)) throw new Error(`${shown} is a symlink; choose another --output`);
  if (!force && !(await isReplaceable(target))) {
    throw new Error(`${shown} exists and is not a NightOwl suggested-rules file; use --force to replace it`);
  }
  await writeFileAtomic(target, content, 0o600);
  io.stderr(`nightowl suggest-rules: wrote ${shown}\n`);
}

export function createSuggestRulesCommand(deps: SuggestRulesDeps = defaultDeps): Command {
  return {
    name: 'suggest-rules',
    summary: 'Suggest project rules from repeated AI failures',
    help: renderCommandHelp({
      name: 'suggest-rules',
      usage: '[options]',
      description: [
        'Groups classified failures into Markdown rule drafts (heuristic by default).',
        'Does not call an LLM unless you pass --yes. Does not edit CLAUDE.md or .cursorrules;',
        'use --output to write a separate suggestion file (look for the NightOwl marker).',
      ],
      options: [
        ['--since <YYYY-MM-DD>', 'Only failures from this date on'],
        ['--category <name>', `Category filter; repeatable (default: ${DEFAULT_CATEGORIES.join(', ')})`],
        ['--agent <id>', `Agent filter; repeatable (${AGENT_IDS.join(', ')}, unknown)`],
        ['--status <name>', `Status filter; repeatable (default: ${DEFAULT_STATUSES.join(', ')})`],
        ['--min-count <n>', `Minimum failures per cluster (default: ${DEFAULT_MIN_COUNT})`],
        ['--limit <n>', `Max clusters/rules to emit (default: 20, max ${MAX_LIMIT})`],
        ['--output <file>', 'Write Markdown to this path instead of stdout'],
        ['--write <file>', 'Alias for --output'],
        ['--force', 'Overwrite a file that is not a NightOwl suggested-rules file'],
        ['--yes', 'Opt in to LLM rewrite of the heuristic drafts'],
        ['--transport cli|api', 'How to call the model with --yes (default: cli)'],
        ['--model <name>', `Model for --yes (default: ${DEFAULT_MODEL})`],
      ],
    }),
    run: async (args, io) => {
      const options = parseOptions(args);
      if (typeof options === 'string') {
        io.stderr(`nightowl suggest-rules: ${options}\n`);
        return 1;
      }

      const cwd = deps.cwd();
      const store = await openExistingStore(cwd);
      if (typeof store === 'string') {
        io.stderr(`nightowl suggest-rules: ${store}\n`);
        return 1;
      }

      try {
        const failures = store.listFailuresForRules({
          since: options.since,
          statuses: options.statuses,
          categories: options.categories,
          agents: options.agents,
        });
        let rules = buildHeuristicRules(failures, { minCount: options.minCount, limit: options.limit });

        if (options.yes) {
          if (options.transport === 'api' && !(deps.env()[ANTHROPIC_API_KEY_ENV] ?? '').trim()) {
            io.stderr(`nightowl suggest-rules: set ${ANTHROPIC_API_KEY_ENV} to use --transport api\n`);
            return 1;
          }
          const llmDeps: RulesLlmDeps = {
            runClaude: deps.runClaude,
            runApi: deps.runApi,
            env: deps.env,
          };
          rules = await enrichRulesWithLlm(rules, { transport: options.transport, model: options.model }, llmDeps);
          const via =
            options.transport === 'api'
              ? `Anthropic API (${ANTHROPIC_API_HOST}), model ${resolveApiModel(options.model)}`
              : `Claude Code, model ${options.model}`;
          io.stderr(`nightowl suggest-rules: rewrote ${rules.length} rules via ${via}\n`);
        }

        const markdown = formatSuggestedRules(rules, deps.now().toISOString());
        if (options.output === null) {
          io.stdout(markdown.endsWith('\n') ? markdown : `${markdown}\n`);
        } else {
          await writeOutput(options.output, markdown.endsWith('\n') ? markdown : `${markdown}\n`, options.force, cwd, io);
        }
        return 0;
      } catch (error) {
        io.stderr(`nightowl suggest-rules: ${printable(errorMessage(error))}\n`);
        return 1;
      } finally {
        store.close();
      }
    },
  };
}

export const suggestRulesCommand = createSuggestRulesCommand();

export { RULES_MARKER };

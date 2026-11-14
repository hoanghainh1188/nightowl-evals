import { mkdir, open, readFile, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
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
import { evalLoopNextStepsAfterSuggest } from '../eval/loop-hints.js';
import { fileBeforeKey, readFilesBefore } from '../export/file-before.js';
import { UNCLASSIFIED } from '../report/build.js';
import { detectFramework } from '../regressions/detect.js';
import {
  formatJsonFixture,
  formatPreview,
  formatStubTest,
  fixtureFileName,
  hasRegressionMarker,
  isNightOwlEvalJson,
  stubFileName,
} from '../regressions/format.js';
import { enrichRegressionsWithLlm, type RegressionLlmDeps, type RegressionTransport } from '../regressions/llm.js';
import { selectRegressionScaffolds } from '../regressions/select.js';
import {
  DEFAULT_LIMIT,
  DEFAULT_STATUSES,
  MAX_LIMIT,
  type FailureStatus,
  type RegressionFramework,
  type RegressionScaffold,
} from '../regressions/types.js';
import { isSymlink, writeFileAtomic } from '../setup/fs-utils.js';
import { parseDateOption } from '../shared/date-option.js';
import { printable } from '../shared/printable.js';
import type { Command } from './command.js';
import { DEFAULT_MODEL, MODEL_NAME } from './classify.js';
import { openExistingStore } from './existing-store.js';

const CATEGORY_NAMES = new Set([...Object.keys(CATEGORIES), UNCLASSIFIED]);
const STATUSES: readonly FailureStatus[] = ['flagged', 'confirmed', 'dismissed'];
const FRAMEWORKS: readonly RegressionFramework[] = ['json', 'vitest', 'jest'];

export interface SuggestRegressionsDeps {
  readonly cwd: () => string;
  readonly runClaude: RunClaude;
  readonly runApi: RunAnthropicApi;
  readonly env: () => NodeJS.ProcessEnv;
}

const defaultDeps: SuggestRegressionsDeps = {
  cwd: () => process.cwd(),
  runClaude,
  runApi: runAnthropicApi,
  env: () => process.env,
};

interface Options {
  readonly since: string | null;
  readonly categories: readonly string[] | null;
  readonly agents: readonly string[] | null;
  readonly statuses: readonly FailureStatus[];
  readonly limit: number;
  readonly framework: RegressionFramework | 'auto';
  readonly output: string | null;
  readonly force: boolean;
  readonly yes: boolean;
  readonly model: string;
  readonly transport: RegressionTransport;
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
        limit: { type: 'string' },
        framework: { type: 'string' },
        output: { type: 'string' },
        force: { type: 'boolean' },
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

  if (values.output === '') return '--output needs a directory path';

  const since = values.since === undefined ? null : parseDateOption(values.since);
  if (since === null && values.since !== undefined) return `invalid --since date (use YYYY-MM-DD): ${values.since}`;

  const categories = values.category ?? null;
  if (categories !== null) {
    const unknown = categories.find((name) => !CATEGORY_NAMES.has(name));
    if (unknown !== undefined) {
      return `unknown --category: ${unknown} (use one of ${[...CATEGORY_NAMES].join(', ')})`;
    }
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

  const limit = values.limit === undefined ? DEFAULT_LIMIT : Number(values.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return `--limit must be a whole number from 1 to ${MAX_LIMIT}`;
  }

  const frameworkRaw = values.framework ?? 'auto';
  if (frameworkRaw !== 'auto' && !FRAMEWORKS.includes(frameworkRaw as RegressionFramework)) {
    return `--framework must be one of auto, ${FRAMEWORKS.join(', ')}`;
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
    limit,
    framework: frameworkRaw as RegressionFramework | 'auto',
    output: values.output ?? null,
    force: values.force === true,
    yes: values.yes === true,
    model,
    transport: transportRaw,
  };
}

async function isReplaceableJson(path: string): Promise<boolean> {
  const handle = await open(path, 'r').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (handle === null) return true;
  try {
    if (!(await handle.stat()).isFile()) return false;
    return isNightOwlEvalJson(await readFile(path, 'utf8'));
  } finally {
    await handle.close();
  }
}

async function isReplaceableStub(path: string): Promise<boolean> {
  const handle = await open(path, 'r').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (handle === null) return true;
  try {
    if (!(await handle.stat()).isFile()) return false;
    const content = await readFile(path, 'utf8');
    return content.trim() === '' || hasRegressionMarker(content);
  } finally {
    await handle.close();
  }
}

async function writeScaffoldFiles(
  scaffolds: readonly RegressionScaffold[],
  framework: RegressionFramework,
  outputDir: string,
  force: boolean,
  cwd: string,
  io: Io,
): Promise<number> {
  const targetDir = resolve(cwd, outputDir);
  if (await isSymlink(targetDir)) throw new Error(`${printable(targetDir)} is a symlink; choose another --output`);
  await mkdir(targetDir, { recursive: true });
  const info = await stat(targetDir);
  if (!info.isDirectory()) throw new Error(`${printable(targetDir)} is not a directory`);

  let written = 0;
  for (const scaffold of scaffolds) {
    const jsonName = fixtureFileName(scaffold.id);
    const jsonPath = join(targetDir, jsonName);
    if (await isSymlink(jsonPath)) throw new Error(`${printable(jsonPath)} is a symlink`);
    if (!force && !(await isReplaceableJson(jsonPath))) {
      throw new Error(`${printable(relative(cwd, jsonPath) || jsonPath)} exists and is not a NightOwl eval fixture; use --force`);
    }
    await writeFileAtomic(jsonPath, formatJsonFixture(scaffold), 0o600);
    written += 1;

    if (framework === 'vitest' || framework === 'jest') {
      const stubName = stubFileName(scaffold.id);
      const stubPath = join(targetDir, stubName);
      if (await isSymlink(stubPath)) throw new Error(`${printable(stubPath)} is a symlink`);
      if (!force && !(await isReplaceableStub(stubPath))) {
        throw new Error(`${printable(relative(cwd, stubPath) || stubPath)} exists and is not a NightOwl regression stub; use --force`);
      }
      await writeFileAtomic(stubPath, formatStubTest(scaffold, framework, jsonName), 0o644);
      written += 1;
    }
  }
  io.stderr(
    `nightowl suggest-regressions: wrote ${written} file(s) under ${printable(relative(cwd, targetDir) || targetDir)}\n` +
      evalLoopNextStepsAfterSuggest(),
  );
  return written;
}

export function createSuggestRegressionsCommand(deps: SuggestRegressionsDeps = defaultDeps): Command {
  return {
    name: 'suggest-regressions',
    summary: 'Suggest regression test scaffolds from confirmed AI failures',
    help: renderCommandHelp({
      name: 'suggest-regressions',
      usage: '[options]',
      description: [
        'Builds nightowl.eval/v1 fixtures (and optional vitest/jest stubs) from recorded failures.',
        'Does not call an LLM unless you pass --yes. Does not write project test files unless --output is set.',
        'Project eval loop (local): after scaffolds, export --status confirmed → eval --label → digest/dashboard.',
      ],
      options: [
        ['--since <YYYY-MM-DD>', 'Only failures from this date on'],
        ['--category <name>', `Category filter; repeatable (${[...CATEGORY_NAMES].join(', ')})`],
        ['--agent <id>', `Agent filter; repeatable (${AGENT_IDS.join(', ')}, unknown)`],
        ['--status <name>', `Status filter; repeatable (default: ${DEFAULT_STATUSES.join(', ')})`],
        ['--limit <n>', `Max failures (default: ${DEFAULT_LIMIT}, max ${MAX_LIMIT})`],
        ['--framework auto|json|vitest|jest', 'Artifact style (default: auto → detect, else json)'],
        ['--output <dir>', 'Write scaffolds into this directory (required to create files)'],
        ['--force', 'Overwrite a file that is not a NightOwl regression artifact'],
        ['--yes', 'Opt in to LLM rewrite of titles/descriptions'],
        ['--transport cli|api', 'How to call the model with --yes (default: cli)'],
        ['--model <name>', `Model for --yes (default: ${DEFAULT_MODEL})`],
      ],
    }),
    run: async (args, io) => {
      const options = parseOptions(args);
      if (typeof options === 'string') {
        io.stderr(`nightowl suggest-regressions: ${options}\n`);
        return 1;
      }

      const cwd = deps.cwd();
      const store = await openExistingStore(cwd);
      if (typeof store === 'string') {
        io.stderr(`nightowl suggest-regressions: ${store}\n`);
        return 1;
      }

      try {
        const failures = store.listFailuresForRegressions({
          since: options.since,
          statuses: options.statuses,
          categories: options.categories,
          agents: options.agents,
          limit: options.limit,
        });
        const committed = failures.flatMap((f) =>
          f.commitSha === null ? [] : [{ commitSha: f.commitSha, filePath: f.filePath }],
        );
        let beforeMap = new Map<string, string | null>();
        try {
          const before = await readFilesBefore(store.root, committed);
          beforeMap = new Map([...before.entries()].map(([key, value]) => [key, value]));
        } catch {
          // Missing git history or non-repo fixtures: scaffolds still work with file_before=null.
        }
        for (const item of committed) {
          const key = fileBeforeKey(item);
          if (!beforeMap.has(key)) beforeMap.set(key, null);
        }

        let { scaffolds, skippedSensitive } = selectRegressionScaffolds(failures, beforeMap);
        const framework =
          options.framework === 'auto' ? await detectFramework(store.root) : options.framework;

        if (options.yes) {
          if (options.transport === 'api' && !(deps.env()[ANTHROPIC_API_KEY_ENV] ?? '').trim()) {
            io.stderr(`nightowl suggest-regressions: set ${ANTHROPIC_API_KEY_ENV} to use --transport api\n`);
            return 1;
          }
          const llmDeps: RegressionLlmDeps = {
            runClaude: deps.runClaude,
            runApi: deps.runApi,
            env: deps.env,
          };
          scaffolds = await enrichRegressionsWithLlm(
            scaffolds,
            { transport: options.transport, model: options.model },
            llmDeps,
          );
          const via =
            options.transport === 'api'
              ? `Anthropic API (${ANTHROPIC_API_HOST}), model ${resolveApiModel(options.model)}`
              : `Claude Code, model ${options.model}`;
          io.stderr(`nightowl suggest-regressions: rewrote titles via ${via}\n`);
        }

        if (options.output === null) {
          io.stdout(formatPreview(scaffolds, framework));
          if (scaffolds[0] !== undefined) {
            io.stdout(`\n# First fixture preview\n${formatJsonFixture(scaffolds[0])}`);
          }
        } else {
          await writeScaffoldFiles(scaffolds, framework, options.output, options.force, cwd, io);
        }

        if (skippedSensitive > 0) {
          io.stderr(`nightowl suggest-regressions: left out ${skippedSensitive} sensitive failure(s)\n`);
        }
        return 0;
      } catch (error) {
        io.stderr(`nightowl suggest-regressions: ${printable(errorMessage(error))}\n`);
        return 1;
      } finally {
        store.close();
      }
    },
  };
}

export const suggestRegressionsCommand = createSuggestRegressionsCommand();

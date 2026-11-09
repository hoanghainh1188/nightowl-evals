import { parseArgs } from 'node:util';
import { errorMessage } from '../cli/errors.js';
import { renderCommandHelp } from '../cli/help.js';
import type { Io } from '../cli/io.js';
import { CLASSIFICATION_SCHEMA, parseClaudeOutput } from '../classify/parse.js';
import { buildPrompt } from '../classify/prompt.js';
import { acquireClassifyLock, ClassifyLockError } from '../classify/lock.js';
import {
  ANTHROPIC_API_HOST,
  ANTHROPIC_API_KEY_ENV,
  type RunAnthropicApi,
  resolveApiModel,
  runAnthropicApi,
} from '../classify/run-api.js';
import { type RunClaude, runClaude } from '../classify/run-claude.js';
import { isOnPath } from '../setup/path.js';
import { printable } from '../shared/printable.js';
import type { FailureToClassify } from '../storage/failures.js';
import type { Store } from '../storage/store.js';
import type { Command } from './command.js';
import { openExistingStoreForWrite } from './existing-store.js';

export const DEFAULT_LIMIT = 20;
export const DEFAULT_MODEL = 'haiku';
// Each call may take up to two minutes; keep a run bounded.
const MAX_LIMIT = 100;
// Plain model names or ids only: never something claude could read as a flag.
export const MODEL_NAME = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
export const INSTALL_HINT = 'Install Claude Code (https://docs.claude.com/claude-code) and make sure `claude` is on your PATH.';
export type ClassifyTransport = 'cli' | 'api';

export interface ClassifyDeps {
  readonly cwd: () => string;
  readonly runClaude: RunClaude;
  readonly runApi: RunAnthropicApi;
  readonly isOnPath: (command: string) => boolean;
  readonly env: () => NodeJS.ProcessEnv;
  readonly now: () => Date;
}

const defaultDeps: ClassifyDeps = {
  cwd: () => process.cwd(),
  runClaude,
  runApi: runAnthropicApi,
  isOnPath: (command) => isOnPath(command, process.env.PATH),
  env: () => process.env,
  now: () => new Date(),
};

interface Options {
  readonly yes: boolean;
  readonly redo: boolean;
  readonly limit: number;
  readonly model: string;
  readonly transport: ClassifyTransport;
}

function parseOptions(args: readonly string[]): Options | string {
  let values;
  try {
    values = parseArgs({
      args: [...args],
      options: {
        yes: { type: 'boolean' },
        redo: { type: 'boolean' },
        limit: { type: 'string' },
        model: { type: 'string' },
        transport: { type: 'string' },
      },
      strict: true,
      allowPositionals: false,
    }).values;
  } catch (error) {
    return errorMessage(error);
  }
  const limit = values.limit === undefined ? DEFAULT_LIMIT : Number(values.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) return `--limit must be a whole number from 1 to ${MAX_LIMIT}`;
  const model = values.model ?? DEFAULT_MODEL;
  if (!MODEL_NAME.test(model)) return `invalid --model: ${model}`;
  const transportRaw = values.transport ?? 'cli';
  if (transportRaw !== 'cli' && transportRaw !== 'api') return `--transport must be cli or api`;
  return { yes: values.yes === true, redo: values.redo === true, limit, model, transport: transportRaw };
}

function kilobytes(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function rerunHint(options: Options): string {
  return [
    'nightowl classify --yes',
    ...(options.transport === 'cli' ? [] : [`--transport ${options.transport}`]),
    ...(options.redo ? ['--redo'] : []),
    ...(options.limit === DEFAULT_LIMIT ? [] : [`--limit ${options.limit}`]),
    ...(options.model === DEFAULT_MODEL ? [] : [`--model ${options.model}`]),
  ].join(' ');
}

function dryRun(failures: readonly FailureToClassify[], options: Options, deps: ClassifyDeps, io: Io): number {
  const prompts = failures.map((failure) => ({ failure, prompt: buildPrompt(failure) }));
  const lines = prompts.map(({ failure, prompt }) => {
    const cut = prompt.truncated.length > 0 ? `, truncated: ${prompt.truncated.join(', ')}` : '';
    return `  #${failure.id} ${printable(failure.filePath)} (${kilobytes(prompt.bytes)}${cut})\n`;
  });
  const total = prompts.reduce((sum, { prompt }) => sum + prompt.bytes, 0);
  const via =
    options.transport === 'api'
      ? `Anthropic API (${ANTHROPIC_API_HOST}), model ${resolveApiModel(options.model)}`
      : `Claude Code, model ${options.model}`;
  const keyNote =
    options.transport === 'api' && !(deps.env()[ANTHROPIC_API_KEY_ENV] ?? '').trim()
      ? `Warning: ${ANTHROPIC_API_KEY_ENV} is not set; --yes will fail until you export it.\n`
      : '';
  io.stdout(
    `Would send ${failures.length} ${failures.length === 1 ? 'failure' : 'failures'} (${kilobytes(total)}) ` +
      `to ${via}:\n${lines.join('')}${keyNote}` +
      `Nothing was sent. The code above leaves your machine only if you run:\n  ${rerunHint(options)}\n`,
  );
  return 0;
}

async function callModel(prompt: string, options: Options, deps: ClassifyDeps): Promise<string> {
  if (options.transport === 'api') {
    const apiKey = deps.env()[ANTHROPIC_API_KEY_ENV];
    return deps.runApi(prompt, {
      model: options.model,
      schema: CLASSIFICATION_SCHEMA,
      ...(apiKey === undefined ? {} : { apiKey }),
    });
  }
  return deps.runClaude(prompt, { model: options.model, schema: CLASSIFICATION_SCHEMA });
}

function classifierLabel(options: Options): string {
  return options.transport === 'api'
    ? `anthropic-api:${resolveApiModel(options.model)}`
    : `claude-code:${options.model}`;
}

async function classifyAll(store: Store, failures: readonly FailureToClassify[], options: Options, deps: ClassifyDeps, io: Io): Promise<number> {
  const counts = new Map<string, number>();
  let failed = 0;
  for (const failure of failures) {
    let error: string;
    try {
      const parsed = parseClaudeOutput(await callModel(buildPrompt(failure).text, options, deps));
      if (parsed.ok) {
        store.saveClassification(failure.id, {
          ...parsed.value,
          classifier: classifierLabel(options),
          classifiedAt: deps.now().toISOString(),
        });
        counts.set(parsed.value.category, (counts.get(parsed.value.category) ?? 0) + 1);
        continue;
      }
      error = parsed.error;
    } catch (caught) {
      error = errorMessage(caught);
    }
    failed += 1;
    store.recordClassifyError(failure.id, error);
    io.stderr(`nightowl classify: #${failure.id} ${printable(failure.filePath)}: ${printable(error)}\n`);
  }

  const classified = failures.length - failed;
  const byCategory = [...counts].map(([category, n]) => `  ${category}: ${n}\n`).join('');
  io.stdout(
    `Classified ${classified} of ${failures.length} ${failures.length === 1 ? 'failure' : 'failures'}\n${byCategory}` +
      (failed > 0 ? `  failed: ${failed}\n` : ''),
  );
  return failed > 0 ? 1 : 0;
}

export function createClassifyCommand(deps: ClassifyDeps = defaultDeps): Command {
  return {
    name: 'classify',
    summary: 'Classify failures with Claude Code or the Anthropic API (dry run unless --yes)',
    help: renderCommandHelp({
      name: 'classify',
      usage: '[options]',
      description: [
        'Asks Claude to sort failures into: logic, convention, misread-requirement, missing-context.',
        'Without --yes it only says what would be sent. With --yes it sends each failure to `claude -p` (default) or the Anthropic API (`--transport api`).',
        `For --transport api, set ${ANTHROPIC_API_KEY_ENV}. Short --model names (haiku, sonnet, opus) map to pinned API model ids.`,
      ],
      options: [
        ['--yes', 'Actually call the model (default: dry run)'],
        ['--transport cli|api', 'How to call the model (default: cli)'],
        [`--limit <1-${MAX_LIMIT}>`, `At most this many failures (default: ${DEFAULT_LIMIT})`],
        ['--model <name>', `Claude model or API model id (default: ${DEFAULT_MODEL})`],
        ['--redo', 'Classify again failures already classified'],
      ],
    }),
    run: async (args, io) => {
      const options = parseOptions(args);
      if (typeof options === 'string') {
        io.stderr(`nightowl classify: ${options}\n`);
        return 1;
      }
      if (options.yes && options.transport === 'cli' && !deps.isOnPath('claude')) {
        io.stderr(`nightowl classify: 'claude' was not found on your PATH.\n  ${INSTALL_HINT}\n`);
        return 1;
      }
      if (options.yes && options.transport === 'api' && !(deps.env()[ANTHROPIC_API_KEY_ENV] ?? '').trim()) {
        io.stderr(`nightowl classify: ${ANTHROPIC_API_KEY_ENV} is not set.\n  export ${ANTHROPIC_API_KEY_ENV}=… and retry with --transport api.\n`);
        return 1;
      }

      // Never creates .nightowl/ or upgrades the schema: that is what nightowl init is for.
      const store = await openExistingStoreForWrite(deps.cwd());
      if (typeof store === 'string') {
        io.stderr(`nightowl classify: ${store}\n`);
        return 1;
      }
      let release: (() => Promise<void>) | null = null;
      try {
        // Taken before the list is read, so two runs never pick the same failures.
        if (options.yes) release = await acquireClassifyLock(store.root);
        const failures = store.listFailuresToClassify(options.limit, options.redo);
        if (failures.length === 0) {
          io.stdout('No failures to classify.\n');
          return 0;
        }
        return options.yes ? await classifyAll(store, failures, options, deps, io) : dryRun(failures, options, deps, io);
      } catch (error) {
        if (!(error instanceof ClassifyLockError)) throw error;
        io.stderr(`nightowl classify: ${printable(error.message)}\n`);
        return 1;
      } finally {
        await release?.();
        store.close();
      }
    },
  };
}

export const classifyCommand = createClassifyCommand();

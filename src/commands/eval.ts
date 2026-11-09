import { randomBytes } from 'node:crypto';
import { join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { errorMessage } from '../cli/errors.js';
import { renderCommandHelp } from '../cli/help.js';
import type { Io } from '../cli/io.js';
import { type RunClaude, runClaude } from '../classify/run-claude.js';
import { type EvalCase, type LoadedCases, loadCases, type SkipReason } from '../eval/cases.js';
import { parseGeneratedFile } from '../eval/parse.js';
import { buildEvalPrompt, GENERATED_FILE_SCHEMA } from '../eval/prompt.js';
import {
  DEFAULT_TEST_TIMEOUT_SEC,
  MAX_TEST_TIMEOUT_SEC,
  MIN_TEST_TIMEOUT_SEC,
  type RunShellCommand,
  runShellCommand,
  type TestRunResult,
  withSwappedFile,
} from '../eval/run-tests.js';
import { type Score, scoreOutput } from '../eval/score.js';
import { isOnPath } from '../setup/path.js';
import { writeFileAtomic } from '../setup/fs-utils.js';
import { printable } from '../shared/printable.js';
import { ensurePrivateDir } from '../shared/private-dir.js';
import { findProjectRoot } from '../storage/project-root.js';
import { DATA_DIR } from '../storage/store.js';
import { INSTALL_HINT, MODEL_NAME } from './classify.js';
import type { Command } from './command.js';
import { EXPORT_DIR, EXPORT_FILE } from './export.js';

export const DEFAULT_MODELS: readonly string[] = Object.freeze(['haiku', 'sonnet']);
export const DEFAULT_EVAL_LIMIT = 20;
export const EVAL_TIMEOUT_MS = 180_000;
export const RUNS_DIR = 'runs';
const MAX_LIMIT = 100;
const MAX_LISTED_DIFFERENCES = 20;

export interface EvalDeps {
  readonly cwd: () => string;
  readonly runClaude: RunClaude;
  readonly runShell: RunShellCommand;
  readonly isOnPath: (command: string) => boolean;
  readonly now: () => Date;
}

const defaultDeps: EvalDeps = {
  cwd: () => process.cwd(),
  runClaude,
  runShell: runShellCommand,
  isOnPath: (command) => isOnPath(command, process.env.PATH),
  now: () => new Date(),
};

interface Options {
  readonly yes: boolean;
  readonly input: string | null;
  readonly models: readonly string[];
  readonly customModels: boolean;
  readonly limit: number;
  readonly testCommand: string | null;
  readonly testTimeoutSec: number;
  readonly requireTests: boolean;
}

interface Result {
  readonly caseId: string;
  readonly model: string;
  readonly output: string | null;
  readonly score: Score | null;
  readonly error: string | null;
  readonly testsPassed: boolean | null;
  readonly testsExitCode: number | null;
  readonly testsError: string | null;
}

function parseOptions(args: readonly string[]): Options | string {
  let values;
  try {
    values = parseArgs({
      args: [...args],
      options: {
        yes: { type: 'boolean' },
        input: { type: 'string' },
        model: { type: 'string', multiple: true },
        limit: { type: 'string' },
        'test-command': { type: 'string' },
        'test-timeout': { type: 'string' },
        'require-tests': { type: 'boolean' },
      },
      strict: true,
      allowPositionals: false,
    }).values;
  } catch (error) {
    return errorMessage(error);
  }
  const limit = values.limit === undefined ? DEFAULT_EVAL_LIMIT : Number(values.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) return `--limit must be a whole number from 1 to ${MAX_LIMIT}`;
  const models = [...new Set(values.model ?? DEFAULT_MODELS)];
  const bad = models.find((model) => !MODEL_NAME.test(model));
  if (bad !== undefined) return `invalid --model: ${bad}`;
  if (values.input === '') return '--input needs a file path';
  const testCommand = values['test-command'] ?? null;
  if (testCommand === '') return '--test-command needs a shell command';
  const testTimeoutSec =
    values['test-timeout'] === undefined ? DEFAULT_TEST_TIMEOUT_SEC : Number(values['test-timeout']);
  if (
    !Number.isInteger(testTimeoutSec) ||
    testTimeoutSec < MIN_TEST_TIMEOUT_SEC ||
    testTimeoutSec > MAX_TEST_TIMEOUT_SEC
  ) {
    return `--test-timeout must be a whole number from ${MIN_TEST_TIMEOUT_SEC} to ${MAX_TEST_TIMEOUT_SEC}`;
  }
  const requireTests = values['require-tests'] === true;
  if (requireTests && testCommand === null) return '--require-tests needs --test-command';
  return {
    yes: values.yes === true,
    input: values.input ?? null,
    models,
    customModels: values.model !== undefined,
    limit,
    testCommand,
    testTimeoutSec,
    requireTests,
  };
}

const SKIP_LABELS: Readonly<Record<SkipReason, string>> = {
  'no-prompt': 'without prompt',
  'too-large': 'too large',
  sensitive: 'sensitive files',
  'no-change': 'no line changed',
  duplicate: 'duplicate ids',
  invalid: 'invalid lines',
};

function skippedNote(loaded: LoadedCases): string {
  const parts = (Object.keys(SKIP_LABELS) as SkipReason[])
    .filter((reason) => loaded.skipped[reason] > 0)
    .map((reason) => `${loaded.skipped[reason]} ${SKIP_LABELS[reason]}`);
  return parts.length === 0 ? '' : ` (skipped: ${parts.join(', ')})`;
}

// Quoted so the hint can be pasted into a shell as is.
function shellQuote(value: string): string {
  return /^[\w./-]+$/.test(value) ? value : `'${value.replaceAll("'", "'\\''")}'`;
}

const MAX_LISTED_FILES = 20;

function listFiles(cases: readonly EvalCase[]): string {
  const files = [...new Set(cases.map((evalCase) => evalCase.filePath))];
  const shown = files.slice(0, MAX_LISTED_FILES).map((file) => `  ${printable(file)}\n`);
  return shown.join('') + (files.length > shown.length ? `  … and ${files.length - shown.length} more\n` : '');
}

function rerunHint(options: Options): string {
  return [
    'nightowl eval --yes',
    ...(options.input === null ? [] : [`--input ${shellQuote(options.input)}`]),
    ...(options.customModels ? options.models.map((model) => `--model ${model}`) : []),
    ...(options.limit === DEFAULT_EVAL_LIMIT ? [] : [`--limit ${options.limit}`]),
    ...(options.testCommand === null ? [] : [`--test-command ${shellQuote(options.testCommand)}`]),
    ...(options.testTimeoutSec === DEFAULT_TEST_TIMEOUT_SEC ? [] : [`--test-timeout ${options.testTimeoutSec}`]),
    ...(options.requireTests ? ['--require-tests'] : []),
  ].join(' ');
}

function dryRun(cases: readonly EvalCase[], loaded: LoadedCases, options: Options, io: Io): number {
  const bytes = cases.reduce((sum, evalCase) => sum + Buffer.byteLength(buildEvalPrompt(evalCase)), 0) * options.models.length;
  const testNote =
    options.testCommand === null
      ? ''
      : `After each answer, would run ${printable(options.testCommand)} in the project root ` +
        `(timeout ${options.testTimeoutSec}s${options.requireTests ? '; pass requires tests' : ''}).\n`;
  io.stdout(
    `Would run ${cases.length} cases × ${options.models.length} models (${options.models.join(', ')}) = ` +
      `${cases.length * options.models.length} calls to Claude Code, ${(bytes / 1024).toFixed(1)} KB${skippedNote(loaded)}.\n` +
      `Files whose content would be sent:\n${listFiles(cases)}` +
      testNote +
      `Nothing was sent. The code leaves your machine only if you run:\n  ${printable(rerunHint(options))}\n`,
  );
  return 0;
}

function applyRequireTests(score: Score, tests: TestRunResult | null, requireTests: boolean): Score {
  if (!requireTests || tests === null) return score;
  return { ...score, pass: score.pass && tests.passed };
}

function emptyTests(): Pick<Result, 'testsPassed' | 'testsExitCode' | 'testsError'> {
  return { testsPassed: null, testsExitCode: null, testsError: null };
}

async function runTestsIfConfigured(
  evalCase: EvalCase,
  content: string,
  root: string,
  options: Options,
  deps: EvalDeps,
): Promise<TestRunResult | null> {
  if (options.testCommand === null) return null;
  const absolutePath = join(root, evalCase.filePath);
  return withSwappedFile(absolutePath, content, () =>
    deps.runShell(options.testCommand as string, {
      cwd: root,
      timeoutMs: options.testTimeoutSec * 1000,
    }),
  );
}

async function runOne(evalCase: EvalCase, model: string, root: string, options: Options, deps: EvalDeps): Promise<Result> {
  try {
    const stdout = await deps.runClaude(buildEvalPrompt(evalCase), {
      model,
      schema: GENERATED_FILE_SCHEMA,
      timeoutMs: EVAL_TIMEOUT_MS,
    });
    const generated = parseGeneratedFile(stdout);
    if (!generated.ok) {
      return { caseId: evalCase.id, model, output: null, score: null, error: generated.error, ...emptyTests() };
    }
    const textual = scoreOutput({ rejected: evalCase.rejected, expected: evalCase.expected, output: generated.content });
    let tests: TestRunResult | null = null;
    try {
      tests = await runTestsIfConfigured(evalCase, generated.content, root, options, deps);
    } catch (error) {
      return {
        caseId: evalCase.id,
        model,
        output: generated.content,
        score: applyRequireTests(textual, { passed: false, exitCode: null, error: errorMessage(error) }, options.requireTests),
        error: null,
        testsPassed: false,
        testsExitCode: null,
        testsError: errorMessage(error),
      };
    }
    return {
      caseId: evalCase.id,
      model,
      output: generated.content,
      score: applyRequireTests(textual, tests, options.requireTests),
      error: null,
      testsPassed: tests?.passed ?? null,
      testsExitCode: tests?.exitCode ?? null,
      testsError: tests?.error ?? null,
    };
  } catch (error) {
    return { caseId: evalCase.id, model, output: null, score: null, error: errorMessage(error), ...emptyTests() };
  }
}

function summary(results: readonly Result[], models: readonly string[], withTests: boolean): string {
  const rows = models.map((model) => {
    const mine = results.filter((r) => r.model === model);
    const scored = mine.filter((r) => r.score !== null);
    const passed = scored.filter((r) => r.score?.pass).length;
    const mean = scored.length === 0 ? 'n/a' : (scored.reduce((sum, r) => sum + (r.score?.score ?? 0), 0) / scored.length).toFixed(2);
    const base = [model, String(scored.length), String(passed), mean, String(mine.length - scored.length)];
    if (!withTests) return base;
    const tested = mine.filter((r) => r.testsPassed !== null);
    const testsOk = tested.filter((r) => r.testsPassed).length;
    return [...base, String(testsOk), String(tested.length)];
  });
  const header = withTests
    ? ['model', 'scored', 'passed', 'mean score', 'failed calls', 'tests ok', 'tested']
    : ['model', 'scored', 'passed', 'mean score', 'failed calls'];
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((row) => (row[i] as string).length)));
  const format = (row: readonly string[]) =>
    `  ${row.map((cell, i) => (i === 0 ? cell.padEnd(widths[i] as number) : cell.padStart(widths[i] as number))).join('  ')}`;
  return [format(header), ...rows.map(format)].join('\n');
}

interface CaseResults {
  readonly caseId: string;
  readonly results: readonly Result[];
}

// Cases where models that produced a scored answer disagree on pass/fail. Failed calls are not
// a "fail": they say nothing about the model's answer.
function differences(byCase: readonly CaseResults[], models: readonly string[]): string {
  if (models.length < 2) return '';
  const lines: string[] = [];
  for (const { caseId, results } of byCase) {
    const scored = results.filter((r) => r.score !== null);
    const passed = scored.filter((r) => r.score?.pass).map((r) => r.model);
    if (scored.length < 2 || passed.length === 0 || passed.length === scored.length) continue;
    const failed = scored.filter((r) => !r.score?.pass).map((r) => r.model);
    lines.push(`  ${printable(caseId)}: passed by ${passed.join(', ')}; not by ${failed.join(', ')}`);
  }
  if (lines.length === 0) return 'Same pass/fail result for every case the models answered.\n';
  const shown = lines.slice(0, MAX_LISTED_DIFFERENCES);
  const more = lines.length > shown.length ? `  … and ${lines.length - shown.length} more (see the results file)\n` : '';
  return `Different results (${lines.length}):\n${shown.join('\n')}\n${more}`;
}

// Created before any paid call, so a folder problem never throws away the answers.
async function resultsFile(root: string, runAt: Date): Promise<string> {
  const stamp = runAt.toISOString().replace(/[:.]/g, '-');
  return join(await ensurePrivateDir(root, RUNS_DIR), `${stamp}-${randomBytes(3).toString('hex')}.jsonl`);
}

async function saveResults(file: string, runAt: Date, results: readonly Result[]): Promise<void> {
  const lines = results.map((r) =>
    JSON.stringify({
      run_at: runAt.toISOString(),
      case_id: r.caseId,
      model: r.model,
      output: r.output,
      coverage: r.score?.coverage ?? null,
      repeat: r.score?.repeat ?? null,
      score: r.score?.score ?? null,
      pass: r.score?.pass ?? null,
      tests_passed: r.testsPassed,
      tests_exit_code: r.testsExitCode,
      tests_error: r.testsError,
      error: r.error,
    }),
  );
  await writeFileAtomic(file, lines.map((line) => `${line}\n`).join(''), 0o600);
}

async function runAll(
  cases: readonly EvalCase[],
  loaded: LoadedCases,
  options: Options,
  root: string,
  deps: EvalDeps,
  io: Io,
): Promise<number> {
  const runAt = deps.now();
  let file: string;
  try {
    file = await resultsFile(root, runAt);
  } catch (error) {
    io.stderr(`nightowl eval: cannot prepare .nightowl/${RUNS_DIR}: ${printable(errorMessage(error))}\n`);
    return 1;
  }
  const byCase: CaseResults[] = [];
  // Sequential, case by case, so every model sees the same cases in the same conditions
  // and --test-command never races on the same file.
  for (const evalCase of cases) {
    const results: Result[] = [];
    for (const model of options.models) {
      const result = await runOne(evalCase, model, root, options, deps);
      if (result.error !== null) io.stderr(`nightowl eval: ${printable(evalCase.id)} with ${model}: ${printable(result.error)}\n`);
      results.push(result);
    }
    byCase.push({ caseId: evalCase.id, results });
  }
  const all = byCase.flatMap((c) => c.results);
  let saved: string;
  try {
    await saveResults(file, runAt, all);
    saved = `Results saved to ${printable(relative(deps.cwd(), file) || file)}\n`;
  } catch (error) {
    io.stderr(`nightowl eval: could not save the results: ${printable(errorMessage(error))}\n`);
    saved = '';
  }
  const withTests = options.testCommand !== null;
  io.stdout(
    `Ran ${cases.length} cases × ${options.models.length} models${skippedNote(loaded)}\n` +
      `${summary(all, options.models, withTests)}\n` +
      differences(byCase, options.models) +
      saved +
      'Scores compare the lines each model changed with the lines the developer changed; a different but valid fix scores low.\n',
  );
  return saved === '' || all.some((r) => r.error !== null) ? 1 : 0;
}

export function createEvalCommand(deps: EvalDeps = defaultDeps): Command {
  return {
    name: 'eval',
    summary: 'Re-run the exported suite with Claude models and compare scores (dry run unless --yes)',
    help: renderCommandHelp({
      name: 'eval',
      usage: '[options]',
      description: [
        'Gives each exported case to Claude models and scores how close each answer is to your fix.',
        'Without --yes it only says what would be sent. With --yes it sends file content to `claude -p`.',
        'With --test-command, each answer is written into the project file, the command runs, then the file is restored.',
      ],
      options: [
        ['--yes', 'Actually call Claude (default: dry run)'],
        ['--input <file>', `Suite to run (default: ${DATA_DIR}/${EXPORT_DIR}/${EXPORT_FILE})`],
        ['--model <name>', `Model to compare; repeatable (default: ${DEFAULT_MODELS.join(', ')})`],
        [`--limit <1-${MAX_LIMIT}>`, `At most this many cases (default: ${DEFAULT_EVAL_LIMIT})`],
        ['--test-command <cmd>', 'Shell command to verify each answer in the project root'],
        [
          `--test-timeout <${MIN_TEST_TIMEOUT_SEC}-${MAX_TEST_TIMEOUT_SEC}>`,
          `Seconds before the test command is killed (default: ${DEFAULT_TEST_TIMEOUT_SEC})`,
        ],
        ['--require-tests', 'Count as pass only when textual score passes and the test command exits 0'],
      ],
    }),
    run: async (args, io) => {
      const options = parseOptions(args);
      if (typeof options === 'string') {
        io.stderr(`nightowl eval: ${options}\n`);
        return 1;
      }
      if (options.yes && !deps.isOnPath('claude')) {
        io.stderr(`nightowl eval: 'claude' was not found on your PATH.\n  ${INSTALL_HINT}\n`);
        return 1;
      }
      const cwd = deps.cwd();
      const root = findProjectRoot(cwd);
      if (root === null) {
        io.stderr(`nightowl eval: ${printable(`no git repository found at or above ${cwd}`)}\n`);
        return 1;
      }
      const input = options.input === null ? join(root, DATA_DIR, EXPORT_DIR, EXPORT_FILE) : resolve(cwd, options.input);
      let loaded: LoadedCases;
      try {
        loaded = await loadCases(input);
      } catch (error) {
        const missing = (error as NodeJS.ErrnoException).code === 'ENOENT';
        const shown = printable(relative(cwd, input) || input);
        io.stderr(
          missing
            ? `nightowl eval: no eval suite at ${shown}. Run 'nightowl export' first.\n`
            : `nightowl eval: cannot read ${shown}: ${printable(errorMessage(error))}\n`,
        );
        return 1;
      }
      const cases = loaded.cases.slice(0, options.limit);
      if (cases.length === 0) {
        io.stdout(`No runnable cases in the suite${skippedNote(loaded)}.\n`);
        return 0;
      }
      return options.yes ? runAll(cases, loaded, options, root, deps, io) : dryRun(cases, loaded, options, io);
    },
  };
}

export const evalCommand = createEvalCommand();

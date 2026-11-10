import { open } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { errorMessage } from '../cli/errors.js';
import { renderCommandHelp } from '../cli/help.js';
import type { Io } from '../cli/io.js';
import { CATEGORIES } from '../classify/prompt.js';
import { EVAL_SCHEMA, evalId, toEvalCase } from '../export/eval-case.js';
import { fileBeforeKey, readFilesBefore } from '../export/file-before.js';
import {
  DEFAULT_FILES,
  EXPORT_FORMATS,
  type ExportFormat,
  PROMPTFOO_MARKER,
  SWE_BENCH_SCHEMA,
  isExportFormat,
} from '../export/formats.js';
import { toPromptfooYaml } from '../export/promptfoo.js';
import { resolveBaseCommit, resolveRepoName, toSweBenchInstance } from '../export/swe-bench.js';
import { containsInlineSecret, isSensitivePath } from '../hooks/claude-code/sensitive.js';
import { GitError, runGit } from '../hooks/git/run-git.js';
import { UNCLASSIFIED } from '../report/build.js';
import { isSymlink, writeFileAtomic } from '../setup/fs-utils.js';
import { parseDateOption } from '../shared/date-option.js';
import { printable } from '../shared/printable.js';
import { ensurePrivateDir } from '../shared/private-dir.js';
import type { FailureToExport } from '../storage/failures.js';
import { DATA_DIR, type Store } from '../storage/store.js';
import type { Command } from './command.js';
import { openExistingStore } from './existing-store.js';

export const EXPORT_DIR = 'export';
export const EXPORT_FILE = DEFAULT_FILES.jsonl;
const CATEGORY_NAMES = new Set([...Object.keys(CATEGORIES), UNCLASSIFIED]);

export interface ExportDeps {
  readonly cwd: () => string;
}

interface Options {
  // null = the default file inside .nightowl/export/; '-' = stdout.
  readonly out: string | null;
  readonly force: boolean;
  readonly since: string | null;
  readonly categories: readonly string[] | null;
  readonly format: ExportFormat;
}

function parseOptions(args: readonly string[]): Options | string {
  let values;
  try {
    values = parseArgs({
      args: [...args],
      options: {
        out: { type: 'string' },
        force: { type: 'boolean' },
        since: { type: 'string' },
        category: { type: 'string', multiple: true },
        format: { type: 'string' },
      },
      strict: true,
      allowPositionals: false,
    }).values;
  } catch (error) {
    return errorMessage(error);
  }
  if (values.out === '') return '--out needs a file path, or - for stdout';
  const since = values.since === undefined ? null : parseDateOption(values.since);
  if (since === null && values.since !== undefined) return `invalid --since date (use YYYY-MM-DD): ${values.since}`;
  const unknown = (values.category ?? []).find((name) => !CATEGORY_NAMES.has(name));
  if (unknown !== undefined) return `unknown --category: ${unknown} (use one of ${[...CATEGORY_NAMES].join(', ')})`;
  const formatRaw = values.format ?? 'jsonl';
  if (!isExportFormat(formatRaw)) {
    return `unknown --format: ${formatRaw} (use one of ${EXPORT_FORMATS.join(', ')})`;
  }
  return {
    out: values.out ?? null,
    force: values.force === true,
    since,
    categories: values.category ?? null,
    format: formatRaw,
  };
}

interface Prepared {
  readonly failures: readonly FailureToExport[];
  readonly before: ReadonlyMap<string, string>;
  readonly sensitive: number;
}

async function prepare(store: Store, options: Options): Promise<Prepared> {
  const all = store.listFailuresToExport({ since: options.since, categories: options.categories });
  const failures = all.filter(
    (failure) =>
      !isSensitivePath(failure.filePath) &&
      !containsInlineSecret(failure.aiContent) &&
      !containsInlineSecret(failure.finalContent),
  );
  const committed = failures.flatMap((f) => (f.commitSha === null ? [] : [{ commitSha: f.commitSha, filePath: f.filePath }]));
  const before = await readFilesBefore(store.root, committed);
  return { failures, before, sensitive: all.length - failures.length };
}

function fileBeforeFor(failure: FailureToExport, before: ReadonlyMap<string, string>): string | null {
  const key = failure.commitSha === null ? null : fileBeforeKey({ commitSha: failure.commitSha, filePath: failure.filePath });
  return key === null ? null : (before.get(key) ?? null);
}

async function buildContent(store: Store, options: Options): Promise<{ content: string; count: number; sensitive: number }> {
  const prepared = await prepare(store, options);
  const { failures, before, sensitive } = prepared;

  if (options.format === 'jsonl') {
    const lines = failures.map((failure) =>
      JSON.stringify(toEvalCase(failure, evalId(failure), fileBeforeFor(failure, before))),
    );
    return { content: lines.map((line) => `${line}\n`).join(''), count: lines.length, sensitive };
  }

  if (options.format === 'swe-bench') {
    const repo = await resolveRepoName(store.root);
    const lines: string[] = [];
    for (const failure of failures) {
      const baseCommit = await resolveBaseCommit(store.root, failure.commitSha);
      lines.push(JSON.stringify(toSweBenchInstance(failure, fileBeforeFor(failure, before), repo, baseCommit)));
    }
    return { content: lines.map((line) => `${line}\n`).join(''), count: lines.length, sensitive };
  }

  const rows = failures.map((failure) => ({ failure, fileBefore: fileBeforeFor(failure, before) }));
  return { content: toPromptfooYaml(rows), count: failures.length, sensitive };
}

async function isReplaceable(path: string, format: ExportFormat): Promise<boolean> {
  const handle = await open(path, 'r').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (handle === null) return true;
  try {
    if (!(await handle.stat()).isFile()) return false;
    const { buffer, bytesRead } = await handle.read(Buffer.alloc(96), 0, 96, 0);
    const start = buffer.subarray(0, bytesRead).toString('utf8');
    if (bytesRead === 0) return true;
    if (format === 'jsonl') return start.startsWith(`{"schema":"${EVAL_SCHEMA.replace(/\/.*$/, '/')}`);
    if (format === 'swe-bench') return start.includes(`"schema":"${SWE_BENCH_SCHEMA}"`);
    return start.startsWith(PROMPTFOO_MARKER);
  } finally {
    await handle.close();
  }
}

async function isGitIgnored(root: string, path: string): Promise<boolean> {
  const inside = relative(root, path);
  if (inside.startsWith('..') || isAbsolute(inside)) return true;
  try {
    await runGit(['check-ignore', '-q', '--', inside], { cwd: root, timeoutMs: 5_000 });
    return true;
  } catch (error) {
    if (error instanceof GitError && error.exitCode === 1) return false;
    throw error;
  }
}

async function defaultTarget(root: string, format: ExportFormat): Promise<string> {
  return join(await ensurePrivateDir(root, EXPORT_DIR), DEFAULT_FILES[format]);
}

async function write(
  built: { content: string; count: number; sensitive: number },
  options: Options,
  root: string,
  cwd: string,
  io: Io,
): Promise<void> {
  const { content, count, sensitive } = built;
  const skipped = sensitive === 0 ? '' : `  Left out ${sensitive} failures in sensitive files (.env, keys, credentials).\n`;
  const formatNote = options.format === 'jsonl' ? '' : ` (format=${options.format})`;
  if (options.out === '-') {
    io.stdout(content);
    io.stderr(`nightowl export: exported ${count} eval cases${formatNote}\n${skipped}`);
    return;
  }
  const target = options.out === null ? await defaultTarget(root, options.format) : resolve(cwd, options.out);
  const shown = printable(relative(cwd, target) || target);
  if (await isSymlink(target)) throw new Error(`${shown} is a symlink; choose another --out`);
  if (!options.force && !(await isReplaceable(target, options.format))) {
    throw new Error(`${shown} exists and is not a NightOwl export; use --force to replace it`);
  }
  await writeFileAtomic(target, content, 0o600);
  const warning = (await isGitIgnored(root, target))
    ? ''
    : '  Warning: git does not ignore this file, so it could be committed. Add it to .gitignore.\n';
  io.stderr(
    `nightowl export: exported ${count} eval cases${formatNote} to ${shown}\n` +
      skipped +
      '  The file contains code from this project; keep it private.\n' +
      warning,
  );
}

export function createExportCommand(deps: ExportDeps = { cwd: () => process.cwd() }): Command {
  return {
    name: 'export',
    summary: 'Export recorded failures as a JSONL test suite',
    help: renderCommandHelp({
      name: 'export',
      usage: '[options]',
      description: [
        'Writes one case per failure: prompt, file before, AI version and your version.',
        'Formats: jsonl (nightowl.eval/v1), swe-bench (compatible fields), promptfoo (YAML config).',
        'The file contains code from this project; keep it private.',
      ],
      options: [
        ['--out <file>', `Where to write; - for stdout (default: ${DATA_DIR}/${EXPORT_DIR}/<format-file>)`],
        ['--format <name>', `Output format: ${EXPORT_FORMATS.join('|')} (default: jsonl)`],
        ['--force', 'Overwrite a file that is not a NightOwl export'],
        ['--since <YYYY-MM-DD>', 'Only failures from this date on'],
        ['--category <name>', `Only this category; repeatable (${[...CATEGORY_NAMES].join(', ')})`],
      ],
    }),
    run: async (args, io) => {
      const options = parseOptions(args);
      if (typeof options === 'string') {
        io.stderr(`nightowl export: ${options}\n`);
        return 1;
      }
      const cwd = deps.cwd();
      const store = await openExistingStore(cwd);
      if (typeof store === 'string') {
        io.stderr(`nightowl export: ${store}\n`);
        return 1;
      }
      try {
        await write(await buildContent(store, options), options, store.root, cwd, io);
        return 0;
      } catch (error) {
        io.stderr(`nightowl export: ${printable(errorMessage(error))}\n`);
        return 1;
      } finally {
        store.close();
      }
    },
  };
}

export const exportCommand = createExportCommand();

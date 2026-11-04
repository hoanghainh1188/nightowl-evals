import { open } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { errorMessage } from '../cli/errors.js';
import type { Io } from '../cli/io.js';
import { CATEGORIES } from '../classify/prompt.js';
import { EVAL_SCHEMA, evalId, toEvalCase } from '../export/eval-case.js';
import { fileBeforeKey, readFilesBefore } from '../export/file-before.js';
import { isSensitivePath } from '../hooks/claude-code/sensitive.js';
import { GitError, runGit } from '../hooks/git/run-git.js';
import { UNCLASSIFIED } from '../report/build.js';
import { isSymlink, writeFileAtomic } from '../setup/fs-utils.js';
import { parseDateOption } from '../shared/date-option.js';
import { printable } from '../shared/printable.js';
import { ensurePrivateDir } from '../shared/private-dir.js';
import type { Store } from '../storage/store.js';
import type { Command } from './command.js';
import { openExistingStore } from './existing-store.js';

export const EXPORT_DIR = 'export';
export const EXPORT_FILE = 'evals.jsonl';
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
  return { out: values.out ?? null, force: values.force === true, since, categories: values.category ?? null };
}

interface Built {
  readonly lines: readonly string[];
  readonly sensitive: number;
}

async function buildLines(store: Store, options: Options): Promise<Built> {
  const all = store.listFailuresToExport({ since: options.since, categories: options.categories });
  // The hook never stores such files, but rows from an older NightOwl or another tool might.
  const failures = all.filter((failure) => !isSensitivePath(failure.filePath));
  const committed = failures.flatMap((f) => (f.commitSha === null ? [] : [{ commitSha: f.commitSha, filePath: f.filePath }]));
  const before = await readFilesBefore(store.root, committed);
  const lines = failures.map((failure) => {
    const key = failure.commitSha === null ? null : fileBeforeKey({ commitSha: failure.commitSha, filePath: failure.filePath });
    return JSON.stringify(toEvalCase(failure, evalId(failure), key === null ? null : (before.get(key) ?? null)));
  });
  return { lines, sensitive: all.length - failures.length };
}

// Only an earlier export (or an empty file) may be replaced without --force.
async function isReplaceable(path: string): Promise<boolean> {
  const handle = await open(path, 'r').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (handle === null) return true;
  try {
    if (!(await handle.stat()).isFile()) return false;
    const { buffer, bytesRead } = await handle.read(Buffer.alloc(64), 0, 64, 0);
    const start = buffer.subarray(0, bytesRead).toString('utf8');
    // Any version of the format counts as an earlier export.
    return bytesRead === 0 || start.startsWith(`{"schema":"${EVAL_SCHEMA.replace(/\/.*$/, '/')}`);
  } finally {
    await handle.close();
  }
}

// True when git would leave the file out of commits; files outside the project count as ignored.
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

// The default folder sits inside .nightowl/ (git-ignored) and is private to the user.
async function defaultTarget(root: string): Promise<string> {
  return join(await ensurePrivateDir(root, EXPORT_DIR), EXPORT_FILE);
}

async function write(built: Built, options: Options, root: string, cwd: string, io: Io): Promise<void> {
  const { lines, sensitive } = built;
  const content = lines.map((line) => `${line}\n`).join('');
  const skipped = sensitive === 0 ? '' : `  Left out ${sensitive} failures in sensitive files (.env, keys, credentials).\n`;
  if (options.out === '-') {
    io.stdout(content);
    io.stderr(`nightowl export: exported ${lines.length} eval cases\n${skipped}`);
    return;
  }
  const target = options.out === null ? await defaultTarget(root) : resolve(cwd, options.out);
  const shown = printable(relative(cwd, target) || target);
  // Checked first: following the link would replace a file elsewhere.
  if (await isSymlink(target)) throw new Error(`${shown} is a symlink; choose another --out`);
  if (!options.force && !(await isReplaceable(target))) {
    throw new Error(`${shown} exists and is not a NightOwl export; use --force to replace it`);
  }
  await writeFileAtomic(target, content, 0o600);
  const warning = (await isGitIgnored(root, target))
    ? ''
    : '  Warning: git does not ignore this file, so it could be committed. Add it to .gitignore.\n';
  io.stderr(
    `nightowl export: exported ${lines.length} eval cases to ${shown}\n` +
      skipped +
      '  The file contains code from this project; keep it private.\n' +
      warning,
  );
}

export function createExportCommand(deps: ExportDeps = { cwd: () => process.cwd() }): Command {
  return {
    name: 'export',
    summary: 'Export recorded failures as a JSONL test suite',
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
        await write(await buildLines(store, options), options, store.root, cwd, io);
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

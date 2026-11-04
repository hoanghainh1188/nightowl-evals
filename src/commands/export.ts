import { lstat, mkdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { errorMessage } from '../cli/errors.js';
import type { Io } from '../cli/io.js';
import { CATEGORIES } from '../classify/prompt.js';
import { evalIds, toEvalCase } from '../export/eval-case.js';
import { fileBeforeKey, readFilesBefore } from '../export/file-before.js';
import { UNCLASSIFIED } from '../report/build.js';
import { writeFileAtomic } from '../setup/fs-utils.js';
import { parseDateOption } from '../shared/date-option.js';
import { printable } from '../shared/printable.js';
import { DATA_DIR, type Store } from '../storage/store.js';
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
  readonly since: string | null;
  readonly categories: readonly string[] | null;
}

function parseOptions(args: readonly string[]): Options | string {
  let values;
  try {
    values = parseArgs({
      args: [...args],
      options: { out: { type: 'string' }, since: { type: 'string' }, category: { type: 'string', multiple: true } },
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
  return { out: values.out ?? null, since, categories: values.category ?? null };
}

async function buildLines(store: Store, options: Options): Promise<readonly string[]> {
  const failures = store.listFailuresToExport({ since: options.since, categories: options.categories });
  const committed = failures.flatMap((f) => (f.commitSha === null ? [] : [{ commitSha: f.commitSha, filePath: f.filePath }]));
  const before = await readFilesBefore(store.root, committed);
  const ids = evalIds(failures);
  return failures.map((failure, i) => {
    const key = failure.commitSha === null ? null : fileBeforeKey({ commitSha: failure.commitSha, filePath: failure.filePath });
    return JSON.stringify(toEvalCase(failure, ids[i] as string, key === null ? null : (before.get(key) ?? null)));
  });
}

// The default folder sits inside .nightowl/ (git-ignored) and is private to the user.
async function defaultTarget(root: string): Promise<string> {
  const dir = join(root, DATA_DIR, EXPORT_DIR);
  await mkdir(dir, { mode: 0o700 }).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'EEXIST') throw error;
  });
  if ((await lstat(dir)).isSymbolicLink()) throw new Error(`${dir} is a symlink`);
  return join(dir, EXPORT_FILE);
}

async function write(lines: readonly string[], options: Options, root: string, cwd: string, io: Io): Promise<void> {
  const content = lines.map((line) => `${line}\n`).join('');
  if (options.out === '-') {
    io.stdout(content);
    io.stderr(`nightowl export: exported ${lines.length} eval cases\n`);
    return;
  }
  const target = options.out === null ? await defaultTarget(root) : resolve(cwd, options.out);
  await writeFileAtomic(target, content, 0o600);
  io.stderr(
    `nightowl export: exported ${lines.length} eval cases to ${printable(relative(cwd, target) || target)}\n` +
      '  The file contains code from this project; keep it private.\n',
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
      let store: Store | string;
      try {
        store = await openExistingStore(cwd);
      } catch (error) {
        store = errorMessage(error);
      }
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

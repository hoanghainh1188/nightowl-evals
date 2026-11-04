import { randomBytes } from 'node:crypto';
import { link, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isSymlink } from '../setup/fs-utils.js';
import { DATA_DIR } from '../storage/store.js';

export const LOCK_FILE = 'classify.lock';

export class ClassifyLockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClassifyLockError';
  }
}

export interface LockDeps {
  readonly pid: number;
  readonly isAlive: (pid: number) => boolean;
  readonly now: () => Date;
}

// `kill(pid, 0)` sends nothing; EPERM means the process exists but belongs to someone else.
export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

const defaultDeps: LockDeps = { pid: process.pid, isAlive: isProcessAlive, now: () => new Date() };

const code = (error: unknown) => (error as NodeJS.ErrnoException).code;

function holderOf(raw: string): number | null {
  try {
    const pid = (JSON.parse(raw) as { pid?: unknown }).pid;
    return Number.isInteger(pid) && (pid as number) > 0 ? (pid as number) : null;
  } catch {
    return null;
  }
}

const readRaw = (path: string) => readFile(path, 'utf8').catch((error: unknown) => (code(error) === 'ENOENT' ? null : Promise.reject(error)));

// `link` is atomic and fails when the lock exists, so the lock appears fully written or not at all.
async function linkInto(source: string, path: string): Promise<boolean> {
  try {
    await link(source, path);
    return true;
  } catch (error) {
    if (code(error) === 'EEXIST') return false;
    throw error;
  }
}

// Moves the stale lock aside and keeps it moved only if it is the one judged stale: if another
// process replaced it in between, its fresh lock goes back and we give up.
async function removeStale(path: string, judged: string, dir: string): Promise<'removed' | 'gone' | 'taken'> {
  const aside = join(dir, `.${LOCK_FILE}.stale.${randomBytes(6).toString('hex')}`);
  try {
    await rename(path, aside);
  } catch (error) {
    if (code(error) === 'ENOENT') return 'gone';
    throw error;
  }
  const moved = await readRaw(aside);
  if (moved !== judged) {
    await linkInto(aside, path).catch(() => false);
    await unlink(aside).catch(() => undefined);
    return 'taken';
  }
  await unlink(aside).catch(() => undefined);
  return 'removed';
}

async function takeLock(path: string, mine: string, dir: string, deps: LockDeps): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (await isSymlink(path)) throw new ClassifyLockError(`${path} is a symlink; remove it by hand`);
    if (await linkInto(mine, path)) return;
    const raw = await readRaw(path);
    if (raw === null) continue;
    const pid = holderOf(raw);
    if (pid !== null && pid !== deps.pid && deps.isAlive(pid)) {
      throw new ClassifyLockError(`another classify is running (pid ${pid}). If it is not, delete ${path}`);
    }
    if ((await removeStale(path, raw, dir)) === 'taken') {
      throw new ClassifyLockError(`another classify has just started. If it has not, delete ${path}`);
    }
  }
  throw new ClassifyLockError(`could not take ${path}; another classify may have just started`);
}

// Only one `classify --yes` may call claude at a time in a project. Returns the release function.
// A lock whose process has ended, or that cannot be read, is replaced once.
export async function acquireClassifyLock(root: string, deps: LockDeps = defaultDeps): Promise<() => Promise<void>> {
  const dir = join(root, DATA_DIR);
  const path = join(dir, LOCK_FILE);
  const mine = join(dir, `.${LOCK_FILE}.${deps.pid}.${randomBytes(6).toString('hex')}.tmp`);
  const content = JSON.stringify({ pid: deps.pid, started_at: deps.now().toISOString() });
  try {
    await writeFile(mine, content, { flag: 'wx', mode: 0o600 });
    try {
      await takeLock(path, mine, dir, deps);
    } finally {
      await unlink(mine).catch(() => undefined);
    }
  } catch (error) {
    if (error instanceof ClassifyLockError) throw error;
    throw new ClassifyLockError(`could not take ${path} (${error instanceof Error ? error.message : String(error)})`);
  }
  return async () => {
    const raw = await readRaw(path).catch(() => null);
    if (raw === content) await unlink(path).catch(() => undefined);
  };
}

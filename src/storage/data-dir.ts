import { chmodSync, lstatSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const DATA_DIR = '.nightowl';
const PRIVATE_MODE = 0o700;

export class DataDirError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataDirError';
  }
}

function createPrivateDir(dir: string): void {
  try {
    mkdirSync(dir, { mode: PRIVATE_MODE });
  } catch (error) {
    // Another hook process may have created it a moment ago; the checks below still apply.
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
}

function applyPrivateMode(dir: string, platform: NodeJS.Platform): void {
  try {
    chmodSync(dir, PRIVATE_MODE);
  } catch {
    if (platform === 'win32') return;
    throw new DataDirError(`could not set private mode on ${dir}`);
  }
  if (platform === 'win32') return;
  const info = lstatSync(dir);
  if ((info.mode & 0o777) !== PRIVATE_MODE) {
    chmodSync(dir, PRIVATE_MODE);
  }
}

// Creates <root>/.nightowl readable only by the current user (POSIX 0700).
// On win32, chmod is best-effort: NTFS may not reflect 0700; still refuse symlinks.
export function ensureDataDir(root: string, platform: NodeJS.Platform = process.platform): string {
  const dir = join(root, DATA_DIR);
  createPrivateDir(dir);
  const info = lstatSync(dir);
  if (info.isSymbolicLink()) throw new DataDirError(`${dir} is a symlink; refusing to use it`);
  if (!info.isDirectory()) throw new DataDirError(`${dir} is not a directory`);
  applyPrivateMode(dir, platform);
  return dir;
}

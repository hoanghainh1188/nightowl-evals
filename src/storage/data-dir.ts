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

// Creates <root>/.nightowl readable only by the current user. Refuses a symlink, so a
// cloned repository cannot redirect NightOwl's data somewhere else.
export function ensureDataDir(root: string): string {
  const dir = join(root, DATA_DIR);
  createPrivateDir(dir);
  const info = lstatSync(dir);
  if (info.isSymbolicLink()) throw new DataDirError(`${dir} is a symlink; refusing to use it`);
  if (!info.isDirectory()) throw new DataDirError(`${dir} is not a directory`);
  // mkdir's mode is reduced by the umask, and older directories may be wider.
  if ((info.mode & 0o777) !== PRIVATE_MODE) chmodSync(dir, PRIVATE_MODE);
  return dir;
}

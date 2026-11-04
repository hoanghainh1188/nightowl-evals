import { chmod, lstat, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ensureDataDir } from '../storage/data-dir.js';

const PRIVATE_MODE = 0o700;

// A folder inside .nightowl/ (git-ignored) that only the user can read. Creates .nightowl/
// with the same checks as the database, refuses symlinks, and narrows a wider folder.
export async function ensurePrivateDir(root: string, name: string): Promise<string> {
  const dir = join(ensureDataDir(root), name);
  await mkdir(dir, { mode: PRIVATE_MODE }).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'EEXIST') throw error;
  });
  const info = await lstat(dir);
  if (info.isSymbolicLink()) throw new Error(`${dir} is a symlink`);
  if (!info.isDirectory()) throw new Error(`${dir} is not a directory`);
  if ((info.mode & 0o777) !== PRIVATE_MODE) await chmod(dir, PRIVATE_MODE);
  return dir;
}

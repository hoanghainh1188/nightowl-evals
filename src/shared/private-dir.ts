import { lstat, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { DATA_DIR } from '../storage/data-dir.js';

// A folder inside .nightowl/ (git-ignored) that only the user can read. Refuses a symlink.
export async function ensurePrivateDir(root: string, name: string): Promise<string> {
  const dir = join(root, DATA_DIR, name);
  await mkdir(dir, { mode: 0o700 }).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'EEXIST') throw error;
  });
  if ((await lstat(dir)).isSymbolicLink()) throw new Error(`${dir} is a symlink`);
  return dir;
}

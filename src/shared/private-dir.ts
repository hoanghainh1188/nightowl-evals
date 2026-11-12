import { chmod, lstat, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ensureDataDir } from '../storage/data-dir.js';

const PRIVATE_MODE = 0o700;

async function applyPrivateMode(dir: string, platform: NodeJS.Platform): Promise<void> {
  try {
    await chmod(dir, PRIVATE_MODE);
  } catch {
    if (platform === 'win32') return;
    throw new Error(`could not set private mode on ${dir}`);
  }
  if (platform === 'win32') return;
  const info = await lstat(dir);
  if ((info.mode & 0o777) !== PRIVATE_MODE) await chmod(dir, PRIVATE_MODE);
}

// A folder inside .nightowl/ (git-ignored) that only the user can read. Creates .nightowl/
// with the same checks as the database, refuses symlinks, and narrows a wider folder on POSIX.
export async function ensurePrivateDir(
  root: string,
  name: string,
  platform: NodeJS.Platform = process.platform,
): Promise<string> {
  const dir = join(ensureDataDir(root, platform), name);
  await mkdir(dir, { mode: PRIVATE_MODE }).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'EEXIST') throw error;
  });
  const info = await lstat(dir);
  if (info.isSymbolicLink()) throw new Error(`${dir} is a symlink`);
  if (!info.isDirectory()) throw new Error(`${dir} is not a directory`);
  await applyPrivateMode(dir, platform);
  return dir;
}

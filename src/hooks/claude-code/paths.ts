import { realpath } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

const PRIVATE_DIRS = new Set(['.git', '.nightowl']);

async function realpathOrSelf(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch {
    // The file may not exist (deleted, or never created): resolve its directory instead.
    try {
      return join(await realpath(dirname(path)), basename(path));
    } catch {
      return path;
    }
  }
}

// Project-relative path ('/'-separated) of a file the agent touched, or null when it
// lies outside the project or inside a directory NightOwl must not record.
export async function projectRelativePath(root: string, cwd: string, filePath: string): Promise<string | null> {
  const realRoot = await realpathOrSelf(root);
  const target = await realpathOrSelf(resolve(cwd, filePath));
  const rel = relative(realRoot, target);
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) return null;
  const parts = rel.split(sep);
  if (PRIVATE_DIRS.has(parts[0] ?? '')) return null;
  return parts.join('/');
}

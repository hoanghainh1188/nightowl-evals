import { realpath } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

const PRIVATE_DIRS = new Set(['.git', '.nightowl']);

async function resolveReal(path: string): Promise<string | null> {
  try {
    return await realpath(path);
  } catch {
    // The file itself may be gone; its directory must still resolve, or we cannot
    // tell whether the path escapes the project through a symlink.
    try {
      return join(await realpath(dirname(path)), basename(path));
    } catch {
      return null;
    }
  }
}

// Project-relative path ('/'-separated) of a file the agent touched, or null when it
// lies outside the project or inside a directory NightOwl must not record.
export async function projectRelativePath(root: string, cwd: string, filePath: string): Promise<string | null> {
  const realRoot = (await resolveReal(root)) ?? root;
  const target = await resolveReal(resolve(cwd, filePath));
  if (target === null) return null;
  const rel = relative(realRoot, target);
  if (rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return null;
  const parts = rel.split(sep);
  // Case-insensitive file systems (macOS, Windows) would otherwise let `.GIT/` through.
  if (PRIVATE_DIRS.has((parts[0] ?? '').toLowerCase())) return null;
  return parts.join('/');
}

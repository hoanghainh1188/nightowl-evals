import { join } from 'node:path';
import { readTextIfExists, writeFileAtomic } from './fs-utils.js';

export const NIGHTOWL_IGNORE = '.nightowl/';

export type FileChange = 'created' | 'updated' | 'unchanged';

function normalise(line: string): string {
  return line.trim().replace(/^\//, '').replace(/\/$/, '');
}

// Returns the new .gitignore content, or null when the entry is already there.
export function addGitignoreEntry(content: string | null, entry: string): string | null {
  if (content === null) return `${entry}\n`;
  const wanted = normalise(entry);
  if (content.split(/\r?\n/).some((line) => normalise(line) === wanted)) return null;
  const base = content.length === 0 || content.endsWith('\n') ? content : `${content}\n`;
  return `${base}${entry}\n`;
}

export async function ensureGitignoreEntry(root: string, entry = NIGHTOWL_IGNORE): Promise<FileChange> {
  const path = join(root, '.gitignore');
  const current = await readTextIfExists(path);
  const next = addGitignoreEntry(current, entry);
  if (next === null) return 'unchanged';
  await writeFileAtomic(path, next);
  return current === null ? 'created' : 'updated';
}

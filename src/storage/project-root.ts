import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

// The nearest directory holding `.git` (a directory, or a file for worktrees and submodules).
export function findProjectRoot(start: string): string | null {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, '.git'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

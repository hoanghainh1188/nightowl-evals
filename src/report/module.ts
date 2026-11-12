import { normalizeRepoPath } from '../shared/repo-path.js';

export const ROOT_MODULE = '(root)';

// The first `depth` directories of a project-relative path.
export function moduleOf(filePath: string, depth: number): string {
  const dirs = normalizeRepoPath(filePath).split('/').slice(0, -1);
  return dirs.length === 0 ? ROOT_MODULE : dirs.slice(0, depth).join('/');
}

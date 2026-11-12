import { moduleOf } from '../report/module.js';
import { normalizeRepoPath } from '../shared/repo-path.js';
import type { Workspace } from './types.js';

/** Longest-prefix workspace root that contains the file, or null. */
export function findNearestWorkspace(filePath: string, workspaces: readonly Workspace[]): Workspace | null {
  const normalized = normalizeRepoPath(filePath);
  let best: Workspace | null = null;
  let bestLen = -1;
  for (const ws of workspaces) {
    const root = normalizeRepoPath(ws.path);
    if (normalized === root || normalized.startsWith(`${root}/`)) {
      if (root.length > bestLen) {
        best = ws;
        bestLen = root.length;
      }
    }
  }
  return best;
}

export function workspaceLabel(ws: Workspace): string {
  return ws.name !== null && ws.name.length > 0 ? ws.name : ws.path;
}

/** Prefer workspace package label; otherwise depth-based `moduleOf`. */
export function moduleLabel(filePath: string, depth: number, workspaces: readonly Workspace[] = []): string {
  const nearest = findNearestWorkspace(filePath, workspaces);
  if (nearest !== null) return workspaceLabel(nearest);
  return moduleOf(filePath, depth);
}

export function pathInWorkspaces(filePath: string, selected: readonly Workspace[]): boolean {
  return findNearestWorkspace(filePath, selected) !== null;
}

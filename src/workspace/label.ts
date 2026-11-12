import { moduleOf } from '../report/module.js';
import type { Workspace } from './types.js';

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\.\/+/, '');
}

/** Longest-prefix workspace root that contains the file, or null. */
export function findNearestWorkspace(filePath: string, workspaces: readonly Workspace[]): Workspace | null {
  const normalized = normalizePath(filePath);
  let best: Workspace | null = null;
  for (const ws of workspaces) {
    const root = ws.path;
    if (normalized === root || normalized.startsWith(`${root}/`)) {
      if (best === null || ws.path.length > best.path.length) best = ws;
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

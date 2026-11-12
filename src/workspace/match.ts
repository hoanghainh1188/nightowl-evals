import { findNearestWorkspace, workspaceLabel } from './label.js';
import type { Workspace } from './types.js';

/**
 * Resolve `--workspace` values against discovered packages.
 * Matches package `name` or relative `path`. Unknown → error string.
 */
export function resolveWorkspaceSelection(
  flags: readonly string[],
  discovered: readonly Workspace[],
): readonly Workspace[] | string {
  if (flags.length === 0) return [];
  const selected: Workspace[] = [];
  for (const raw of flags) {
    const flag = raw.trim();
    if (flag.length === 0) return '--workspace cannot be empty';
    const hits = discovered.filter((ws) => ws.path === flag || ws.name === flag);
    if (hits.length === 0) {
      const known = discovered.map((ws) => workspaceLabel(ws)).join(', ') || '(none)';
      return `unknown --workspace: ${flag} (known: ${known})`;
    }
    if (hits.length > 1) {
      return `ambiguous --workspace: ${flag} matches ${hits.map((h) => h.path).join(', ')}`;
    }
    selected.push(hits[0]!);
  }
  // de-dupe by path
  const byPath = new Map(selected.map((ws) => [ws.path, ws]));
  return Object.freeze([...byPath.values()]);
}

/**
 * Keep rows whose nearest package (among `all`) is in `selected`.
 * Using `all` avoids parent-prefix false positives when a nested package exists.
 */
export function filterPathsByWorkspaces<T extends { readonly filePath: string }>(
  rows: readonly T[],
  selected: readonly Workspace[],
  all: readonly Workspace[] = selected,
): readonly T[] {
  if (selected.length === 0) return rows;
  const selectedPaths = new Set(selected.map((ws) => ws.path));
  return rows.filter((row) => {
    const nearest = findNearestWorkspace(row.filePath, all);
    return nearest !== null && selectedPaths.has(nearest.path);
  });
}

import type { CheckCountRow } from '../storage/report-queries.js';
import { discoverWorkspaces } from './discover.js';
import { filterPathsByWorkspaces, resolveWorkspaceSelection } from './match.js';
import type { Workspace } from './types.js';

export interface WorkspaceReportContext {
  readonly all: readonly Workspace[];
  /** null = no --workspace filter. */
  readonly filter: readonly Workspace[] | null;
}

export async function prepareWorkspaces(
  projectRoot: string,
  flags: readonly string[],
): Promise<WorkspaceReportContext | string> {
  const all = await discoverWorkspaces(projectRoot);
  if (flags.length === 0) return { all, filter: null };
  const selected = resolveWorkspaceSelection(flags, all);
  if (typeof selected === 'string') return selected;
  return { all, filter: selected };
}

export function applyWorkspaceFilter<T extends { readonly filePath: string }>(
  rows: readonly T[],
  filter: readonly Workspace[] | null,
  all: readonly Workspace[] = filter ?? [],
): readonly T[] {
  if (filter === null) return rows;
  return filterPathsByWorkspaces(rows, filter, all);
}

export interface ScopedChecks {
  readonly scoped: readonly CheckCountRow[];
  /** Checks dropped because filePath was missing while a workspace filter is active. */
  readonly droppedNoPath: number;
  readonly fullChecked: number;
}

/** When filter is set, keep only path-bearing checks in selected workspaces. */
export function scopeChecksForWorkspace(
  checks: readonly CheckCountRow[],
  filter: readonly Workspace[] | null,
  all: readonly Workspace[],
): ScopedChecks {
  const fullChecked = checks.reduce((sum, row) => sum + row.count, 0);
  if (filter === null) return { scoped: checks, droppedNoPath: 0, fullChecked };

  let droppedNoPath = 0;
  const withPath: Array<CheckCountRow & { readonly filePath: string }> = [];
  for (const row of checks) {
    if (row.filePath === null || row.filePath === '') {
      droppedNoPath += row.count;
      continue;
    }
    withPath.push({ ...row, filePath: row.filePath });
  }
  return {
    scoped: filterPathsByWorkspaces(withPath, filter, all),
    droppedNoPath,
    fullChecked,
  };
}

/** Warn when --fail-on-rate + --workspace cannot share a clean check denominator. */
export function workspaceFailOnRateWarning(
  filterActive: boolean,
  failOnRate: boolean,
  scoped: ScopedChecks,
): string | null {
  if (!filterActive || !failOnRate) return null;
  if (scoped.droppedNoPath > 0) {
    return `nightowl report: warning: ${scoped.droppedNoPath} check(s) lack file_path and were excluded from --workspace changedRate; --fail-on-rate uses the scoped denominator.\n`;
  }
  const scopedChecked = scoped.scoped.reduce((sum, row) => sum + row.count, 0);
  if (scoped.fullChecked > 0 && scopedChecked === 0) {
    return `nightowl report: warning: --workspace filter left changedRate.checked at 0 while ${scoped.fullChecked} check(s) exist in the full window; --fail-on-rate may not gate as expected.\n`;
  }
  return null;
}

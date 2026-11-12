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

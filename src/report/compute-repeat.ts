import type { Store } from '../storage/store.js';
import { applyWorkspaceFilter } from '../workspace/for-report.js';
import type { Workspace } from '../workspace/types.js';
import { measureRepeatOutcomes, resolveBaselineSince, type RepeatOutcomes } from './repeat.js';

/** Load baseline + window failures and measure repeat outcomes for report/digest/dashboard. */
export function computeRepeatFromStore(options: {
  readonly store: Store;
  readonly since: string | null;
  readonly agents: readonly string[] | null;
  readonly depth: number;
  readonly workspaces: readonly Workspace[];
  readonly workspaceFilter: readonly Workspace[] | null;
  readonly now: Date;
  readonly baselineSinceOption?: string;
}): RepeatOutcomes | { readonly error: string } {
  const resolved = resolveBaselineSince({
    windowSince: options.since,
    baselineSinceOption: options.baselineSinceOption,
    now: options.now,
  });
  if ('error' in resolved) return resolved;
  const baselineSince = resolved.baselineSince;
  const windowFailures = applyWorkspaceFilter(
    options.store.listFailuresForClustering(options.since, options.agents),
    options.workspaceFilter,
    options.workspaces,
  );
  const baselineFailures =
    baselineSince === null
      ? []
      : applyWorkspaceFilter(
          options.store.listFailuresForClustering(baselineSince, options.agents, options.since),
          options.workspaceFilter,
          options.workspaces,
        );
  return measureRepeatOutcomes({
    baseline: baselineFailures,
    window: windowFailures,
    depth: options.depth,
    workspaces: options.workspaces,
    baselineSince,
    windowSince: options.since,
  });
}

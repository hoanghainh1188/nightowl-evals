import { clusterKeyForFailure } from '../cluster/group.js';
import type { ClusterableFailure } from '../cluster/types.js';
import { DEFAULT_CLUSTER_DEPTH } from '../cluster/types.js';
import { parseDateOption } from '../shared/date-option.js';
import type { Workspace } from '../workspace/types.js';

export interface RepeatOutcomes {
  readonly repeatCount: number;
  readonly newCount: number;
  /** null when repeat+new === 0. */
  readonly repeatRate: number | null;
  readonly baselineSince: string | null;
  readonly windowSince: string | null;
}

export const EMPTY_REPEAT: RepeatOutcomes = Object.freeze({
  repeatCount: 0,
  newCount: 0,
  repeatRate: null,
  baselineSince: null,
  windowSince: null,
});

export interface MeasureRepeatInput {
  readonly baseline: readonly ClusterableFailure[];
  readonly window: readonly ClusterableFailure[];
  readonly depth?: number;
  readonly workspaces?: readonly Workspace[];
  readonly baselineSince: string | null;
  readonly windowSince: string | null;
}

/** Distinct cluster keys for non-dismissed failures (same key rules as report clustering). */
export function collectClusterKeys(
  failures: readonly ClusterableFailure[],
  depth = DEFAULT_CLUSTER_DEPTH,
  workspaces: readonly Workspace[] = [],
): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const failure of failures) {
    if (failure.status === 'dismissed') continue;
    keys.add(clusterKeyForFailure(failure, depth, workspaces));
  }
  return keys;
}

export function measureRepeatOutcomes(input: MeasureRepeatInput): RepeatOutcomes {
  const depth = input.depth ?? DEFAULT_CLUSTER_DEPTH;
  const workspaces = input.workspaces ?? [];
  const baselineKeys = collectClusterKeys(input.baseline, depth, workspaces);
  const windowKeys = collectClusterKeys(input.window, depth, workspaces);
  let repeatCount = 0;
  let newCount = 0;
  for (const key of windowKeys) {
    if (baselineKeys.has(key)) repeatCount += 1;
    else newCount += 1;
  }
  const denom = repeatCount + newCount;
  return Object.freeze({
    repeatCount,
    newCount,
    repeatRate: denom === 0 ? null : repeatCount / denom,
    baselineSince: input.baselineSince,
    windowSince: input.windowSince,
  });
}

/** Baseline start = window start minus the same duration as [windowSince, now]. */
export function defaultBaselineSince(windowSince: string, now: Date): string {
  const windowStart = new Date(windowSince).getTime();
  const durationMs = Math.max(0, now.getTime() - windowStart);
  return new Date(windowStart - durationMs).toISOString();
}

/**
 * Resolve baseline ISO start.
 * - Explicit `--baseline-since` wins when parseable.
 * - Else if windowSince set: same-duration window before it.
 * - Else: null (empty baseline → all window keys count as new).
 */
export function resolveBaselineSince(options: {
  readonly windowSince: string | null;
  readonly baselineSinceOption: string | null | undefined;
  readonly now: Date;
}): { readonly baselineSince: string | null } | { readonly error: string } {
  if (options.baselineSinceOption !== undefined && options.baselineSinceOption !== null) {
    const parsed = parseDateOption(options.baselineSinceOption);
    if (parsed === null) {
      return { error: `invalid --baseline-since date (use YYYY-MM-DD): ${options.baselineSinceOption}` };
    }
    if (options.windowSince !== null && parsed >= options.windowSince) {
      return { error: '--baseline-since must be before --since' };
    }
    return { baselineSince: parsed };
  }
  if (options.windowSince === null) return { baselineSince: null };
  return { baselineSince: defaultBaselineSince(options.windowSince, options.now) };
}

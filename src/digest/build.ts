import { resolveRuleImpactSummary, type RuleImpactSummary, type RuleImpactView } from '../impact/summary.js';
import { buildReport, type ReportSignals } from '../report/build.js';
import { SIGNAL_KINDS } from '../storage/events.js';
import type { Store } from '../storage/store.js';
import { applyWorkspaceFilter, scopeChecksForWorkspace } from '../workspace/for-report.js';
import type { Workspace } from '../workspace/types.js';

export const TOP_DIGEST_ROWS = 5;

export interface DigestTopRow {
  readonly name: string;
  readonly count: number;
}

export type DigestRuleImpact = RuleImpactSummary;

export interface Digest {
  readonly generatedAt: string;
  readonly since: string;
  readonly depth: number;
  readonly agents: readonly string[] | null;
  readonly total: number;
  readonly flagged: number;
  readonly topCategories: readonly DigestTopRow[];
  readonly topAgents: readonly DigestTopRow[];
  readonly signals: ReportSignals;
  /** null = none recorded; object = ok; 'unavailable' = compare failed (fail-open). */
  readonly ruleImpact: RuleImpactView;
}

export interface BuildDigestInput {
  readonly store: Store;
  readonly since: string;
  readonly depth: number;
  readonly agents?: readonly string[] | null;
  readonly generatedAt: string;
  readonly nowIso?: string;
  /** All discovered workspaces (for module labels). */
  readonly workspaces?: readonly Workspace[];
  /** Selected workspaces for failure filter; null = no filter. */
  readonly workspaceFilter?: readonly Workspace[] | null;
}

function topRows(map: Readonly<Record<string, number>>, limit: number): readonly DigestTopRow[] {
  return Object.freeze(
    Object.entries(map)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .slice(0, limit)
      .map(([name, count]) => Object.freeze({ name, count })),
  );
}

export function buildDigest(input: BuildDigestInput): Digest {
  const agents = input.agents ?? null;
  const signalCounts = input.store.countEventsByKind(SIGNAL_KINDS, input.since);
  const signals = Object.freeze({
    ciFail: signalCounts['ci-fail'] ?? 0,
    prReview: signalCounts['pr-review'] ?? 0,
    revert: signalCounts['revert'] ?? 0,
  });
  const wsAll = input.workspaces ?? input.workspaceFilter ?? [];
  const failures = applyWorkspaceFilter(
    input.store.countFailuresForReport(input.since, agents),
    input.workspaceFilter ?? null,
    wsAll,
  );
  const checks = scopeChecksForWorkspace(
    input.store.countChecksForReport(input.since, agents),
    input.workspaceFilter ?? null,
    wsAll,
  ).scoped;
  const report =
    input.workspaces === undefined
      ? buildReport({
          failures,
          checks,
          depth: input.depth,
          since: input.since,
          generatedAt: input.generatedAt,
          agents,
          signals,
        })
      : buildReport({
          failures,
          checks,
          depth: input.depth,
          since: input.since,
          generatedAt: input.generatedAt,
          agents,
          signals,
          workspaces: input.workspaces,
        });

  const ruleImpact = resolveRuleImpactSummary(input.store, input.nowIso ?? input.generatedAt);

  return Object.freeze({
    generatedAt: input.generatedAt,
    since: input.since,
    depth: input.depth,
    agents,
    total: report.total,
    flagged: report.byStatus.flagged ?? 0,
    topCategories: topRows(report.byCategory, TOP_DIGEST_ROWS),
    topAgents: topRows(report.byAgent, TOP_DIGEST_ROWS),
    signals,
    ruleImpact,
  });
}

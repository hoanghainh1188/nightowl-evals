import { compareRuleImpact } from '../impact/compare.js';
import { buildReport, type ReportSignals } from '../report/build.js';
import { SIGNAL_KINDS } from '../storage/events.js';
import type { Store } from '../storage/store.js';

export const TOP_DIGEST_ROWS = 5;

export interface DigestTopRow {
  readonly name: string;
  readonly count: number;
}

export interface DigestRuleImpact {
  readonly label: string;
  readonly before: number;
  readonly after: number;
  readonly delta: number;
}

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
  readonly ruleImpact: DigestRuleImpact | null | 'unavailable';
}

export interface BuildDigestInput {
  readonly store: Store;
  readonly since: string;
  readonly depth: number;
  readonly agents?: readonly string[] | null;
  readonly generatedAt: string;
  readonly nowIso?: string;
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
  const report = buildReport({
    failures: input.store.countFailuresForReport(input.since, agents),
    checks: input.store.countChecksForReport(input.since, agents),
    depth: input.depth,
    since: input.since,
    generatedAt: input.generatedAt,
    agents,
    signals,
  });

  let ruleImpact: Digest['ruleImpact'] = null;
  const application = input.store.getLatestRuleApplication();
  if (application !== null) {
    try {
      const comparison = compareRuleImpact(input.store, application, { now: input.nowIso ?? input.generatedAt });
      ruleImpact = Object.freeze({
        label: comparison.label,
        before: comparison.before.total,
        after: comparison.after.total,
        delta: comparison.delta,
      });
    } catch {
      ruleImpact = 'unavailable';
    }
  }

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

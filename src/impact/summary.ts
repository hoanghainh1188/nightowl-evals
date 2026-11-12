import { printable } from '../shared/printable.js';
import type { Store } from '../storage/store.js';
import { compareRuleImpact } from './compare.js';

export interface RuleImpactSummary {
  readonly label: string;
  readonly before: number;
  readonly after: number;
  readonly delta: number;
}

/** null = none recorded; object = ok; 'unavailable' = compare failed (fail-open). */
export type RuleImpactView = RuleImpactSummary | null | 'unavailable';

export function resolveRuleImpactSummary(store: Store, nowIso: string): RuleImpactView {
  const application = store.getLatestRuleApplication();
  if (application === null) return null;
  try {
    const comparison = compareRuleImpact(store, application, { now: nowIso });
    return Object.freeze({
      label: comparison.label,
      before: comparison.before.total,
      after: comparison.after.total,
      delta: comparison.delta,
    });
  } catch {
    return 'unavailable';
  }
}

export function formatRuleImpactLine(view: RuleImpactView): string {
  if (view === null) return 'Rule impact: none recorded';
  if (view === 'unavailable') return 'Rule impact: n/a';
  const sign = view.delta > 0 ? '+' : '';
  return `Rule impact (${printable(view.label)}): ${view.before} → ${view.after} (delta ${sign}${view.delta})`;
}

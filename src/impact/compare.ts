import { shiftIsoDays } from '../storage/impact-queries.js';
import type { RuleApplication, RuleBaseline } from '../storage/rule-applications.js';
import type { Store } from '../storage/store.js';

export const DEFAULT_WINDOW_DAYS = 14;

export interface ImpactComparison {
  readonly label: string;
  readonly appliedAt: string;
  readonly beforeDays: number;
  readonly afterDays: number;
  readonly beforeFrom: string;
  readonly beforeTo: string;
  readonly afterFrom: string;
  readonly afterTo: string;
  readonly afterIncomplete: boolean;
  readonly baselineAtMark: RuleBaseline;
  readonly before: RuleBaseline;
  readonly after: RuleBaseline;
  readonly delta: number;
}

export function compareRuleImpact(
  store: Store,
  application: RuleApplication,
  options: {
    readonly beforeDays?: number;
    readonly afterDays?: number;
    readonly now?: string;
  } = {},
): ImpactComparison {
  const beforeDays = options.beforeDays ?? DEFAULT_WINDOW_DAYS;
  const afterDays = options.afterDays ?? DEFAULT_WINDOW_DAYS;
  const now = options.now ?? new Date().toISOString();
  const appliedAt = application.appliedAt;
  const beforeFrom = shiftIsoDays(appliedAt, -beforeDays);
  const beforeTo = appliedAt;
  const afterFrom = appliedAt;
  const afterIdealEnd = shiftIsoDays(appliedAt, afterDays);
  const afterIncomplete = now < afterIdealEnd;
  const afterTo = afterIncomplete ? now : afterIdealEnd;
  const filterBase = application.filters;
  const before = store.countFailuresInWindow({
    ...filterBase,
    fromInclusive: beforeFrom,
    toExclusive: beforeTo,
  });
  const after = store.countFailuresInWindow({
    ...filterBase,
    fromInclusive: afterFrom,
    toExclusive: afterTo,
  });
  return Object.freeze({
    label: application.label,
    appliedAt,
    beforeDays,
    afterDays,
    beforeFrom,
    beforeTo,
    afterFrom,
    afterTo,
    afterIncomplete,
    baselineAtMark: application.baseline,
    before,
    after,
    delta: after.total - before.total,
  });
}

export function formatImpactText(comparison: ImpactComparison): string {
  const sign = comparison.delta > 0 ? '+' : '';
  const lines = [
    `NightOwl rule impact: ${comparison.label}`,
    `Applied at ${comparison.appliedAt}`,
    `Before [${comparison.beforeFrom.slice(0, 10)} … ${comparison.beforeTo.slice(0, 10)}): ${comparison.before.total} failures`,
    `After  [${comparison.afterFrom.slice(0, 10)} … ${comparison.afterTo.slice(0, 10)}): ${comparison.after.total} failures`,
    `Delta: ${sign}${comparison.delta} (negative means fewer failures after apply)`,
  ];
  if (comparison.afterIncomplete) {
    lines.push(`Note: after window is incomplete (now is before applied_at + ${comparison.afterDays}d).`);
  }
  lines.push(`Baseline total at mark: ${comparison.baselineAtMark.total}`);
  return `${lines.join('\n')}\n`;
}

export function formatImpactJson(comparison: ImpactComparison): string {
  return `${JSON.stringify(
    {
      label: comparison.label,
      applied_at: comparison.appliedAt,
      before_days: comparison.beforeDays,
      after_days: comparison.afterDays,
      before: {
        from: comparison.beforeFrom,
        to: comparison.beforeTo,
        total: comparison.before.total,
        by_category: comparison.before.byCategory,
      },
      after: {
        from: comparison.afterFrom,
        to: comparison.afterTo,
        total: comparison.after.total,
        by_category: comparison.after.byCategory,
        incomplete: comparison.afterIncomplete,
      },
      delta: comparison.delta,
      baseline_at_mark: {
        total: comparison.baselineAtMark.total,
        by_category: comparison.baselineAtMark.byCategory,
      },
    },
    null,
    2,
  )}\n`;
}

import type { DatabaseSync } from 'node:sqlite';
import { moduleOf } from '../report/module.js';
import type { RuleApplicationFilters, RuleBaseline } from './rule-applications.js';

export interface FailureWindowFilter extends RuleApplicationFilters {
  /** Inclusive lower bound (ISO). */
  readonly fromInclusive: string | null;
  /** Exclusive upper bound (ISO). */
  readonly toExclusive: string | null;
}

interface FailureRow {
  category: string | null;
  agent: string | null;
  file_path: string;
}

/** nullAs mirrors SQL COALESCE sentinels used in report queries ('unclassified' / 'unknown'). */
function matchesList(value: string | null, allowed: readonly string[] | null, nullAs: string): boolean {
  if (allowed === null || allowed.length === 0) return true;
  return allowed.includes(value ?? nullAs);
}

/** Count non-dismissed failures in [fromInclusive, toExclusive) matching filters. */
export function countFailuresInWindow(db: DatabaseSync, filter: FailureWindowFilter): RuleBaseline {
  // Avoid GROUP BY COUNT alias quirks: fetch matching rows and aggregate in JS.
  const rows = db
    .prepare(
      `SELECT category, agent, file_path
       FROM failures
       WHERE status != 'dismissed'
         AND (? IS NULL OR created_at >= ?)
         AND (? IS NULL OR created_at < ?)`,
    )
    .all(filter.fromInclusive, filter.fromInclusive, filter.toExclusive, filter.toExclusive) as unknown as FailureRow[];

  const byCategory: Record<string, number> = {};
  let total = 0;
  for (const row of rows) {
    if (!matchesList(row.category, filter.categories, 'unclassified')) continue;
    if (!matchesList(row.agent, filter.agents, 'unknown')) continue;
    if (filter.modules !== null && filter.modules.length > 0) {
      const mod = moduleOf(row.file_path, filter.depth);
      if (!filter.modules.includes(mod)) continue;
    }
    total += 1;
    const key = row.category ?? 'unclassified';
    byCategory[key] = (byCategory[key] ?? 0) + 1;
  }
  return Object.freeze({ total, byCategory: Object.freeze(byCategory) });
}

export function shiftIsoDays(iso: string, days: number): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) throw new Error(`invalid ISO timestamp: ${iso}`);
  return new Date(ms + days * 86_400_000).toISOString();
}

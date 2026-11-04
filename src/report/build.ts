import { CATEGORIES } from '../classify/prompt.js';
import type { CheckCountRow, FailureCountRow } from '../storage/report-queries.js';
import { moduleOf } from './module.js';
import { isoWeek } from './week.js';

export const UNCLASSIFIED = 'unclassified';
export const SOURCES: readonly string[] = Object.freeze(['manual-fix', 'ai-self-fix']);

export interface Rate {
  readonly failures: number;
  readonly checked: number;
  // null when nothing was checked: no data is not 0%.
  readonly rate: number | null;
}

export interface Report {
  readonly generatedAt: string;
  readonly since: string | null;
  readonly depth: number;
  readonly total: number;
  readonly unclassified: number;
  readonly dismissed: number;
  readonly changedRate: Rate;
  readonly byCategory: Readonly<Record<string, number>>;
  readonly bySource: Readonly<Record<string, number>>;
  readonly byModule: ReadonlyArray<{ readonly module: string; readonly failures: number }>;
  readonly byWeek: ReadonlyArray<{ readonly week: string } & Rate & { readonly recorded: number }>;
}

export interface ReportInput {
  readonly failures: readonly FailureCountRow[];
  readonly checks: readonly CheckCountRow[];
  readonly depth: number;
  readonly since: string | null;
  readonly generatedAt: string;
}

function add(map: Map<string, number>, key: string, n: number): void {
  map.set(key, (map.get(key) ?? 0) + n);
}

function rate(failures: number, checked: number): Rate {
  return { failures, checked, rate: checked === 0 ? null : failures / checked };
}

export function buildReport(input: ReportInput): Report {
  const counted = input.failures.filter((row) => row.status !== 'dismissed');
  const dismissed = input.failures.filter((row) => row.status === 'dismissed').reduce((sum, row) => sum + row.count, 0);

  const byCategory = new Map<string, number>([...Object.keys(CATEGORIES), UNCLASSIFIED].map((name) => [name, 0]));
  const bySource = new Map<string, number>(SOURCES.map((name) => [name, 0]));
  const byModule = new Map<string, number>();
  const recordedByWeek = new Map<string, number>();
  for (const row of counted) {
    add(byCategory, row.category ?? UNCLASSIFIED, row.count);
    add(bySource, row.source, row.count);
    add(byModule, moduleOf(row.filePath, input.depth), row.count);
    add(recordedByWeek, isoWeek(row.day), row.count);
  }

  const checkedByWeek = new Map<string, number>();
  const failedByWeek = new Map<string, number>();
  for (const row of input.checks) {
    const week = isoWeek(row.day);
    add(checkedByWeek, week, row.count);
    if (row.outcome === 'failure') add(failedByWeek, week, row.count);
  }
  const sum = (map: Map<string, number>) => [...map.values()].reduce((total, n) => total + n, 0);

  const weeks = [...new Set([...recordedByWeek.keys(), ...checkedByWeek.keys()])].sort();
  return Object.freeze({
    generatedAt: input.generatedAt,
    since: input.since,
    depth: input.depth,
    total: sum(recordedByWeek),
    unclassified: byCategory.get(UNCLASSIFIED) ?? 0,
    dismissed,
    changedRate: rate(sum(failedByWeek), sum(checkedByWeek)),
    byCategory: Object.freeze(Object.fromEntries(byCategory)),
    bySource: Object.freeze(Object.fromEntries(bySource)),
    byModule: Object.freeze(
      [...byModule]
        .map(([module, failures]) => ({ module, failures }))
        .sort((a, b) => b.failures - a.failures || (a.module < b.module ? -1 : a.module > b.module ? 1 : 0)),
    ),
    byWeek: Object.freeze(
      weeks.map((week) => ({
        week,
        recorded: recordedByWeek.get(week) ?? 0,
        ...rate(failedByWeek.get(week) ?? 0, checkedByWeek.get(week) ?? 0),
      })),
    ),
  });
}

import { CATEGORIES } from '../classify/prompt.js';
import type { CheckCountRow, FailureCountRow } from '../storage/report-queries.js';
import { moduleOf } from './module.js';
import { isoWeek } from './week.js';

export const UNCLASSIFIED = 'unclassified';
export const SOURCES: readonly string[] = Object.freeze(['manual-fix', 'ai-self-fix']);
export const STATUSES: readonly string[] = Object.freeze(['confirmed', 'dismissed', 'flagged']);

export interface Rate {
  readonly failures: number;
  readonly checked: number;
  // null when nothing was checked: no data is not 0%.
  readonly rate: number | null;
}

export interface HeadToHeadRow {
  readonly agent: string;
  readonly failures: number;
  readonly checked: number;
  readonly rate: number | null;
}

export interface ReportSignals {
  readonly ciFail: number;
  readonly prReview: number;
}

export interface Report {
  readonly generatedAt: string;
  readonly since: string | null;
  readonly depth: number;
  readonly agents: readonly string[] | null;
  readonly total: number;
  readonly unclassified: number;
  readonly dismissed: number;
  readonly changedRate: Rate;
  readonly byCategory: Readonly<Record<string, number>>;
  readonly bySource: Readonly<Record<string, number>>;
  // Dismissed included: how much of the review is done.
  readonly byStatus: Readonly<Record<string, number>>;
  readonly byAgent: Readonly<Record<string, number>>;
  readonly headToHead: readonly HeadToHeadRow[];
  readonly byModule: ReadonlyArray<{ readonly module: string; readonly failures: number }>;
  readonly byWeek: ReadonlyArray<{ readonly week: string } & Rate & { readonly recorded: number }>;
  /** CI/PR event counts in the same --since window; not mixed into `total`. */
  readonly signals: ReportSignals;
}

export interface ReportInput {
  readonly failures: readonly FailureCountRow[];
  readonly checks: readonly CheckCountRow[];
  readonly depth: number;
  readonly since: string | null;
  readonly generatedAt: string;
  readonly agents?: readonly string[] | null;
  readonly signals?: ReportSignals;
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

  const byStatus = new Map<string, number>(STATUSES.map((name) => [name, 0]));
  for (const row of input.failures) add(byStatus, row.status, row.count);
  const byCategory = new Map<string, number>([...Object.keys(CATEGORIES), UNCLASSIFIED].map((name) => [name, 0]));
  const bySource = new Map<string, number>(SOURCES.map((name) => [name, 0]));
  const byAgent = new Map<string, number>();
  const byModule = new Map<string, number>();
  const recordedByWeek = new Map<string, number>();
  for (const row of counted) {
    add(byCategory, row.category ?? UNCLASSIFIED, row.count);
    add(bySource, row.source, row.count);
    add(byAgent, row.agent ?? 'unknown', row.count);
    add(byModule, moduleOf(row.filePath, input.depth), row.count);
    add(recordedByWeek, isoWeek(row.day), row.count);
  }

  const checkedByWeek = new Map<string, number>();
  const failedByWeek = new Map<string, number>();
  const checkedByAgent = new Map<string, number>();
  const failedByAgent = new Map<string, number>();
  for (const row of input.checks) {
    const week = isoWeek(row.day);
    const agent = row.agent ?? 'unknown';
    add(checkedByWeek, week, row.count);
    add(checkedByAgent, agent, row.count);
    if (row.outcome === 'failure') {
      add(failedByWeek, week, row.count);
      add(failedByAgent, agent, row.count);
    }
  }
  const sum = (map: Map<string, number>) => [...map.values()].reduce((total, n) => total + n, 0);

  const weeks = [...new Set([...recordedByWeek.keys(), ...checkedByWeek.keys()])].sort();
  const headAgents = [...new Set([...byAgent.keys(), ...checkedByAgent.keys()])].sort();
  return Object.freeze({
    generatedAt: input.generatedAt,
    since: input.since,
    depth: input.depth,
    agents: input.agents ?? null,
    total: sum(recordedByWeek),
    unclassified: byCategory.get(UNCLASSIFIED) ?? 0,
    dismissed,
    changedRate: rate(sum(failedByWeek), sum(checkedByWeek)),
    byCategory: Object.freeze(Object.fromEntries(byCategory)),
    bySource: Object.freeze(Object.fromEntries(bySource)),
    byStatus: Object.freeze(Object.fromEntries(byStatus)),
    byAgent: Object.freeze(Object.fromEntries([...byAgent].sort((a, b) => a[0].localeCompare(b[0])))),
    headToHead: Object.freeze(
      headAgents.map((agent) => ({
        agent,
        ...rate(failedByAgent.get(agent) ?? 0, checkedByAgent.get(agent) ?? 0),
      })),
    ),
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
    signals: Object.freeze({
      ciFail: input.signals?.ciFail ?? 0,
      prReview: input.signals?.prReview ?? 0,
    }),
  });
}

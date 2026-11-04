import { describe, expect, it } from 'vitest';
import { buildReport } from '../../src/report/build.js';
import { moduleOf } from '../../src/report/module.js';
import { isoWeek } from '../../src/report/week.js';
import type { FailureCountRow } from '../../src/storage/report-queries.js';

describe('isoWeek', () => {
  it.each([
    ['2026-11-04', '2026-W45'],
    ['2026-11-02', '2026-W45'], // Monday
    ['2026-11-08', '2026-W45'], // Sunday
    ['2027-01-01', '2026-W53'], // Friday belongs to the last week of 2026
    ['2025-12-29', '2026-W01'], // Monday belongs to the first week of 2026
    ['2021-01-03', '2020-W53'],
    ['2024-12-30', '2025-W01'],
  ])('%s is %s', (day, week) => {
    expect(isoWeek(day)).toBe(week);
  });
});

describe('moduleOf', () => {
  it.each([
    ['src/hooks/git/a.ts', 2, 'src/hooks'],
    ['src/hooks/git/a.ts', 1, 'src'],
    ['src/a.ts', 3, 'src'],
    ['README.md', 2, '(root)'],
  ])('%s at depth %i is %s', (path, depth, module) => {
    expect(moduleOf(path, depth)).toBe(module);
  });
});

const row = (
  filePath: string,
  category: string | null,
  day: string,
  count = 1,
  status = 'flagged',
  source = 'manual-fix',
): FailureCountRow => ({ filePath, category, status, source, day, count });

describe('buildReport', () => {
  const base = { depth: 2, since: null, generatedAt: '2026-11-04T12:00:00.000Z' };

  it('counts by category, module and week, without dismissed failures', () => {
    const report = buildReport({
      ...base,
      failures: [
        row('src/hooks/a.ts', 'logic', '2026-11-02', 3),
        row('src/cli/b.ts', 'convention', '2026-11-04'),
        row('src/cli/c.ts', null, '2026-10-28'),
        row('src/cli/d.ts', 'logic', '2026-11-04', 1, 'dismissed'),
      ],
      checks: [],
    });
    expect(report.total).toBe(5);
    expect(report.unclassified).toBe(1);
    expect(report.dismissed).toBe(1);
    expect(report.byCategory).toEqual({
      logic: 3,
      convention: 1,
      'misread-requirement': 0,
      'missing-context': 0,
      unclassified: 1,
    });
    expect(report.byModule).toEqual([
      { module: 'src/hooks', failures: 3 },
      { module: 'src/cli', failures: 2 },
    ]);
    expect(report.byWeek.map((w) => [w.week, w.recorded])).toEqual([
      ['2026-W44', 1],
      ['2026-W45', 4],
    ]);
  });

  it('computes the changed rate in total and per week, and reports no data as null', () => {
    const report = buildReport({
      ...base,
      failures: [],
      checks: [
        { day: '2026-11-02', outcome: 'failure', count: 1 },
        { day: '2026-11-03', outcome: 'not-a-failure', count: 3 },
      ],
    });
    expect(report.changedRate).toEqual({ failures: 1, checked: 4, rate: 0.25 });
    expect(report.byWeek).toEqual([{ week: '2026-W45', recorded: 0, failures: 1, checked: 4, rate: 0.25 }]);
    expect(buildReport({ ...base, failures: [], checks: [] }).changedRate).toEqual({ failures: 0, checked: 0, rate: null });
  });

  it('sorts modules by count, then by name', () => {
    const report = buildReport({
      ...base,
      failures: [row('b/x.ts', null, '2026-11-02'), row('a/x.ts', null, '2026-11-02'), row('c/x.ts', null, '2026-11-02', 2)],
      checks: [],
    });
    expect(report.byModule.map((m) => m.module)).toEqual(['c', 'a', 'b']);
  });

  it('counts by source with both keys, without dismissed failures', () => {
    const report = buildReport({
      ...base,
      failures: [
        row('a.ts', null, '2026-11-02', 2),
        row('b.ts', null, '2026-11-02', 1, 'flagged', 'ai-self-fix'),
        row('c.ts', null, '2026-11-02', 5, 'dismissed', 'ai-self-fix'),
      ],
      checks: [],
    });
    expect(report.bySource).toEqual({ 'manual-fix': 2, 'ai-self-fix': 1 });
    expect(buildReport({ ...base, failures: [], checks: [] }).bySource).toEqual({ 'manual-fix': 0, 'ai-self-fix': 0 });
  });

  it('counts by review status, dismissed included, while the total leaves dismissed out', () => {
    const report = buildReport({
      ...base,
      failures: [
        row('a.ts', null, '2026-11-02', 2, 'confirmed'),
        row('b.ts', null, '2026-11-02', 1, 'dismissed'),
        row('c.ts', null, '2026-11-02', 3),
      ],
      checks: [],
    });
    expect(report.byStatus).toEqual({ confirmed: 2, dismissed: 1, flagged: 3 });
    expect(report.total).toBe(5);
  });
});


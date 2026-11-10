import { describe, expect, it } from 'vitest';
import { buildReport } from '../../src/report/build.js';
import { formatJson, formatText } from '../../src/report/format.js';
import type { FailureCountRow } from '../../src/storage/report-queries.js';

const base = { depth: 2, since: null, generatedAt: '2026-11-04T12:00:00.000Z' };
const row = (filePath: string, category: string | null, day: string, count = 1): FailureCountRow => ({
  filePath,
  category,
  status: 'flagged',
  source: 'manual-fix',
  agent: 'claude-code',
  day,
  count,
});

describe('formatText', () => {
  it('prints totals, rate, categories with bars, modules and weeks', () => {
    const text = formatText(
      buildReport({
        ...base,
        failures: [row('src/hooks/a.ts', 'logic', '2026-11-02', 3), row('src/cli/b.ts', 'convention', '2026-11-04')],
        checks: [
          { day: '2026-11-02', outcome: 'failure', agent: 'claude-code', count: 4 },
          { day: '2026-11-02', outcome: 'not-a-failure', agent: 'claude-code', count: 12 },
        ],
      }),
    );
    expect(text).toContain('NightOwl report: 4 failures (0 unclassified, 0 dismissed not counted)');
    expect(text).toContain('AI edits changed by the developer: 4 of 16 checked at commit (25%)');
    expect(text).toMatch(/^ {2}logic {18}3 {2}█{30}$/m);
    expect(text).toMatch(/^ {2}convention {13}1 {2}█{10}$/m);
    expect(text).toMatch(/^ {2}missing-context {8}0$/m);
    expect(text).toContain('By module (top 2 of 2, depth 2)');
    expect(text).toMatch(/^ {2}src\/hooks .* 3 /m);
    expect(text).toMatch(/^ {2}2026-W45 .*█ 25%$/m);
  });

  it('shows only the top 10 modules and the last 8 weeks', () => {
    const failures = Array.from({ length: 12 }, (_, i) => row(`m${String(i).padStart(2, '0')}/x.ts`, null, `2026-0${1 + (i % 9)}-15`));
    const text = formatText(buildReport({ ...base, failures, checks: [] }));
    expect(text).toContain('By module (top 10 of 12, depth 2)');
    expect(text).toContain('By week (last 8, UTC');
    expect(text).not.toContain('2026-W03'); // January is older than the last 8 weeks
  });

  it('shows n/a when nothing was checked, and says when nothing is recorded', () => {
    expect(formatText(buildReport({ ...base, failures: [row('a/b.ts', null, '2026-11-02')], checks: [] }))).toContain('(n/a)');
    expect(formatText(buildReport({ ...base, failures: [], checks: [] }))).toContain('No failures recorded yet');
    expect(formatText(buildReport({ ...base, failures: [], checks: [], signals: { ciFail: 2, prReview: 1 } }))).toContain(
      'Signals (events, not failures): ci-fail 2, pr-review 1',
    );
  });

  it('mentions the since date and strips control characters from paths', () => {
    const text = formatText(
      buildReport({ ...base, since: '2026-11-01T00:00:00.000Z', failures: [row('\u001b[31mevil/x.ts', null, '2026-11-02')], checks: [] }),
    );
    expect(text).toContain('NightOwl report since 2026-11-01: 1 failure');
    expect(text).not.toContain('\u001b');
  });
});

describe('formatJson', () => {
  it('has the documented fields, with every module and week', () => {
    const failures = Array.from({ length: 12 }, (_, i) => row(`m${i}/x.ts`, 'logic', `2026-0${1 + (i % 9)}-15`));
    const json = JSON.parse(formatJson(buildReport({ ...base, failures, checks: [] })));
    expect(Object.keys(json)).toEqual([
      'generated_at',
      'since',
      'depth',
      'total',
      'unclassified',
      'dismissed',
      'changed_rate',
      'by_category',
      'by_source',
      'by_status',
      'by_agent',
      'head_to_head',
      'agents',
      'by_module',
      'by_week',
      'signals',
    ]);
    expect(json.signals).toEqual({ ci_fail: 0, pr_review: 0 });
    expect(json.by_module).toHaveLength(12);
    expect(json.by_week).toHaveLength(9);
    expect(json.by_week[0]).toEqual({ week: '2026-W03', failures: 2, checked: 0, changed: 0, rate: null });
    expect(json.changed_rate).toEqual({ failures: 0, checked: 0, rate: null });
  });

  it('shows failures by source, in text and JSON', () => {
    const report = buildReport({
      ...base,
      failures: [row('a.ts', null, '2026-11-02', 2), { ...row('b.ts', null, '2026-11-02'), source: 'ai-self-fix' }],
      checks: [],
    });
    expect(formatText(report)).toMatch(/\nBy source\n {2}manual-fix +2 .*\n {2}ai-self-fix +1 /);
    expect(JSON.parse(formatJson(report)).by_source).toEqual({ 'manual-fix': 2, 'ai-self-fix': 1 });
  });

  it('shows how many failures were reviewed, in text and JSON', () => {
    const report = buildReport({
      ...base,
      failures: [row('a.ts', null, '2026-11-02', 2), { ...row('b.ts', null, '2026-11-02'), status: 'confirmed' }],
      checks: [],
    });
    expect(formatText(report)).toContain('Reviewed: 1 confirmed, 0 dismissed, 2 still flagged (nightowl review)');
    expect(JSON.parse(formatJson(report)).by_status).toEqual({ confirmed: 1, dismissed: 0, flagged: 2 });
  });
});


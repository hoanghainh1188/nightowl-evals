import { describe, expect, it } from 'vitest';
import {
  RUN_META_SCHEMA,
  aggregateModels,
  buildCompareReport,
  disagreements,
  formatCompareHtml,
  formatCompareMarkdown,
  parseRunFile,
  type RunResultRow,
} from '../../src/eval/compare.js';

function row(partial: Partial<RunResultRow> & Pick<RunResultRow, 'case_id' | 'model'>): RunResultRow {
  return {
    run_at: '2026-11-12T12:00:00.000Z',
    coverage: partial.score === null ? null : 1,
    repeat: partial.score === null ? null : 0,
    score: 0.8,
    pass: true,
    tests_passed: null,
    error: null,
    ...partial,
  };
}

describe('parseRunFile', () => {
  it('reads optional meta then result rows', () => {
    const text = [
      JSON.stringify({ schema: RUN_META_SCHEMA, label: 'rules-v2', models: ['haiku'], run_at: '2026-11-12T12:00:00.000Z' }),
      JSON.stringify(row({ case_id: 'c1', model: 'haiku', score: 0.9, pass: true })),
      '{not json}',
      JSON.stringify({ case_id: 'x' }),
      '',
    ].join('\n');
    const parsed = parseRunFile(text);
    expect(parsed.meta?.label).toBe('rules-v2');
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]!.case_id).toBe('c1');
  });

  it('allows files without meta (legacy)', () => {
    const text = JSON.stringify(row({ case_id: 'c1', model: 'sonnet', score: 0.5, pass: true })) + '\n';
    const parsed = parseRunFile(text);
    expect(parsed.meta).toBeNull();
    expect(parsed.rows).toHaveLength(1);
  });
});

describe('aggregateModels + disagreements + delta', () => {
  it('aggregates per model and ignores failed calls in disagreements', () => {
    const rows = [
      row({ case_id: 'a', model: 'haiku', score: 0.9, pass: true }),
      row({ case_id: 'a', model: 'sonnet', score: 0.1, pass: false }),
      row({ case_id: 'b', model: 'haiku', score: null, pass: null, error: 'timeout', coverage: null, repeat: null }),
      row({ case_id: 'b', model: 'sonnet', score: 0.8, pass: true }),
    ];
    const stats = aggregateModels(rows);
    expect(stats.find((s) => s.model === 'haiku')).toMatchObject({ scored: 1, passed: 1, failedCalls: 1 });
    expect(stats.find((s) => s.model === 'sonnet')).toMatchObject({ scored: 2, passed: 1, failedCalls: 0 });
    const diffs = disagreements(rows);
    expect(diffs.some((d) => d.startsWith('a:'))).toBe(true);
    expect(diffs.some((d) => d.startsWith('b:'))).toBe(false);
  });

  it('builds deltas vs baseline', () => {
    const current = [
      row({ case_id: 'a', model: 'haiku', score: 0.9, pass: true }),
      row({ case_id: 'b', model: 'haiku', score: 0.8, pass: true }),
    ];
    const baseline = [
      row({ case_id: 'a', model: 'haiku', score: 0.4, pass: false }),
      row({ case_id: 'b', model: 'haiku', score: 0.5, pass: true }),
    ];
    const report = buildCompareReport({
      current: { meta: { schema: RUN_META_SCHEMA, label: 'now', models: ['haiku'], run_at: 't' }, rows: current },
      baseline: { meta: { schema: RUN_META_SCHEMA, label: 'before', models: ['haiku'], run_at: 't0' }, rows: baseline },
      ruleNote: 'Rule applied: none recorded',
    });
    expect(report.deltas?.[0]).toMatchObject({ model: 'haiku', passedDelta: 1 });
    expect(report.label).toBe('now');
    expect(report.baselineLabel).toBe('before');
  });
});

describe('formatCompareMarkdown/Html', () => {
  it('renders table without dumping code output or CDN', () => {
    const report = buildCompareReport({
      current: {
        meta: null,
        rows: [row({ case_id: 'c1', model: 'haiku', score: 0.9, pass: true })],
      },
      baseline: null,
      ruleNote: 'Rule applied: none recorded',
    });
    const md = formatCompareMarkdown(report);
    expect(md).toContain('haiku');
    expect(md).toContain('passed');
    expect(md).not.toContain('function evil');
    const html = formatCompareHtml(report);
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).not.toMatch(/https?:\/\//);
  });
});

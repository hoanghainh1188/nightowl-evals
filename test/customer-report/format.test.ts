import { describe, expect, it } from 'vitest';
import {
  formatCustomerHtml,
  formatCustomerMarkdown,
  formatCustomerReport,
} from '../../src/customer-report/format.js';
import type { Report } from '../../src/report/build.js';
import { EMPTY_REPEAT } from '../../src/report/repeat.js';

function sampleReport(overrides: Partial<Report> = {}): Report {
  return {
    generatedAt: '2026-11-11T12:00:00.000Z',
    since: '2026-11-01T00:00:00.000Z',
    depth: 2,
    agents: null,
    total: 3,
    unclassified: 1,
    dismissed: 0,
    changedRate: { failures: 1, checked: 4, rate: 0.25 },
    byCategory: {
      logic: 2,
      convention: 0,
      'misread-requirement': 0,
      'missing-context': 0,
      unclassified: 1,
    },
    byClassifierSource: { heuristic: 0, llm: 2, unclassified: 1 },
    bySource: { 'manual-fix': 3, 'ai-self-check': 0 },
    byStatus: { confirmed: 1, dismissed: 0, flagged: 2 },
    byAgent: { 'claude-code': 3 },
    headToHead: [{ agent: 'claude-code', failures: 1, checked: 4, rate: 0.25 }],
    byModule: [{ module: 'src/hooks', failures: 3 }],
    byWeek: [{ week: '2026-W45', failures: 1, checked: 4, rate: 0.25, recorded: 3 }],
    signals: { ciFail: 0, prReview: 0, revert: 0 },
    noise: { reviewRate: null, autoNoise: 0, sample: { confirmed: 1, dismissed: 0 } },
    clusters: [],
    repeat: EMPTY_REPEAT,
    ...overrides,
  };
}

describe('customer-report format', () => {
  it('renders bilingual Markdown with key metrics', () => {
    const md = formatCustomerMarkdown(sampleReport(), 'both');
    expect(md).toContain('Báo cáo chất lượng AI (NightOwl)');
    expect(md).toContain('AI品質レポート（NightOwl）');
    expect(md).toContain('Tổng lỗi (không tính dismissed)');
    expect(md).toContain('失敗件数（dismissed除外）');
    expect(md).toContain('25%');
    expect(md).toContain('src/hooks');
    expect(md).toContain('logic');
  });

  it('neutralizes HTML-ish module labels in Markdown', () => {
    const md = formatCustomerMarkdown(
      sampleReport({ byModule: [{ module: 'src/<b>x</b>', failures: 1 }] }),
      'vi',
    );
    expect(md).toContain('src/&lt;b&gt;x&lt;/b&gt;');
    expect(md).not.toContain('src/<b>x</b>');
  });

  it('renders Vietnamese-only Markdown', () => {
    const md = formatCustomerMarkdown(sampleReport(), 'vi');
    expect(md).toContain('Báo cáo chất lượng AI (NightOwl)');
    expect(md).not.toContain('AI品質レポート');
  });

  it('renders empty-state message', () => {
    const md = formatCustomerMarkdown(
      sampleReport({
        total: 0,
        unclassified: 0,
        changedRate: { failures: 0, checked: 0, rate: null },
        byCategory: {
          logic: 0,
          convention: 0,
          'misread-requirement': 0,
          'missing-context': 0,
          unclassified: 0,
        },
        byAgent: {},
        headToHead: [],
        byModule: [],
        byWeek: [],
      }),
      'vi',
    );
    expect(md).toContain('Chưa có đủ dữ liệu');
  });

  it('renders self-contained HTML and escapes special labels', () => {
    const html = formatCustomerHtml(
      sampleReport({
        byModule: [{ module: 'src/<script>alert(1)</script>', failures: 2 }],
        byAgent: { 'agent&x': 2 },
      }),
      'ja',
    );
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('<html lang="ja">');
    expect(html).toContain('<style>');
    expect(html).toContain('src/&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('agent&amp;x');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('formatCustomerReport switches md/html', () => {
    const report = sampleReport();
    expect(formatCustomerReport(report, { lang: 'vi', format: 'md' })).toContain('# Báo cáo');
    expect(formatCustomerReport(report, { lang: 'vi', format: 'html' })).toContain('<!DOCTYPE html>');
  });

  it('never emits author-like PII strings that are not in Report aggregates', () => {
    const secret = 'Alice Developer <alice@example.com>';
    const md = formatCustomerMarkdown(sampleReport(), 'both');
    const html = formatCustomerHtml(sampleReport(), 'both');
    expect(md).not.toContain(secret);
    expect(html).not.toContain(secret);
    expect(md).not.toContain('alice@example.com');
    expect(html).not.toContain('/Users/');
  });
});

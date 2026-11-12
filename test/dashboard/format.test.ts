import { describe, expect, it } from 'vitest';
import { formatDashboardHtml } from '../../src/dashboard/format.js';
import type { Report } from '../../src/report/build.js';

function sampleReport(overrides: Partial<Report> = {}): Report {
  return {
    generatedAt: '2026-11-11T12:00:00.000Z',
    since: '2026-11-01T00:00:00.000Z',
    depth: 2,
    agents: null,
    total: 3,
    unclassified: 0,
    dismissed: 1,
    changedRate: { failures: 1, checked: 4, rate: 0.25 },
    byCategory: { logic: 2, convention: 1, 'missing-context': 0, 'wrong-requirement': 0, unclassified: 0 },
    bySource: { 'manual-fix': 3, 'ai-self-fix': 0 },
    byStatus: { confirmed: 1, dismissed: 1, flagged: 2 },
    byAgent: { 'claude-code': 2, cursor: 1 },
    headToHead: [
      { agent: 'claude-code', failures: 1, checked: 3, rate: 1 / 3 },
      { agent: 'cursor', failures: 0, checked: 1, rate: 0 },
    ],
    byModule: [
      { module: 'src/hooks', failures: 2 },
      { module: 'src/cli', failures: 1 },
    ],
    byWeek: [{ week: '2026-W45', failures: 1, checked: 4, rate: 0.25, recorded: 3 }],
    signals: { ciFail: 2, prReview: 1, revert: 4 },
    noise: { reviewRate: 0.5, autoNoise: 1, sample: { confirmed: 1, dismissed: 1 } },
    clusters: [
      {
        key: 'logic|src/hooks|claude-code|abcd1234abcd1234',
        category: 'logic',
        module: 'src/hooks',
        agent: 'claude-code',
        fingerprint: 'abcd1234abcd1234',
        count: 2,
        sampleIds: [1, 2],
        samplePaths: ['src/hooks/a.ts'],
      },
    ],
    ...overrides,
  };
}

describe('formatDashboardHtml', () => {
  it('renders metrics without external http(s) URLs', () => {
    const html = formatDashboardHtml(sampleReport());
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('NightOwl local dashboard');
    expect(html).toContain('Total failures');
    expect(html).toContain(': 3');
    expect(html).toContain('logic');
    expect(html).toContain('src/hooks');
    expect(html).toContain('claude-code');
    expect(html).toContain('2026-W45');
    expect(html).toContain('25%');
    expect(html).toContain('Noise estimate');
    expect(html).toContain('Auto-noise failures');
    expect(html).toContain('>1<');
    expect(html).toContain('Top clusters');
    expect(html).toContain('Signals');
    expect(html).toContain('revert 4');
    expect(html).not.toMatch(/https?:\/\//);
  });


  it('renders empty state', () => {
    const html = formatDashboardHtml(
      sampleReport({
        total: 0,
        changedRate: { failures: 0, checked: 0, rate: null },
        byModule: [],
        byWeek: [],
        byAgent: {},
        headToHead: [],
      }),
    );
    expect(html).toContain('Not enough data yet');
  });

  it('does not include author-like strings present only in unrelated fixture text', () => {
    const secret = 'Alice Developer <alice@example.com>';
    const html = formatDashboardHtml(sampleReport());
    expect(html).not.toContain('Alice Developer');
    expect(html).not.toContain('alice@example.com');
    expect(html).not.toContain(secret);
  });

  it('escapes HTML-ish module labels', () => {
    const html = formatDashboardHtml(
      sampleReport({
        byModule: [{ module: 'src/<script>alert(1)</script>', failures: 1 }],
      }),
    );
    expect(html).toContain('src/&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});

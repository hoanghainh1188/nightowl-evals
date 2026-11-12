import { describe, expect, it } from 'vitest';
import type { Digest } from '../../src/digest/build.js';
import { formatDigestHtml, formatDigestMarkdown } from '../../src/digest/format.js';

const sample: Digest = {
  generatedAt: '2026-11-12T12:00:00.000Z',
  since: '2026-11-05T00:00:00.000Z',
  depth: 2,
  agents: null,
  total: 3,
  flagged: 2,
  topCategories: [
    { name: 'logic', count: 2 },
    { name: 'convention', count: 1 },
  ],
  topAgents: [{ name: 'claude-code', count: 3 }],
  signals: { ciFail: 1, prReview: 0, revert: 0 },
  ruleImpact: { label: 'r1', before: 5, after: 2, delta: -3 },
};

describe('formatDigestMarkdown', () => {
  it('includes totals, flagged, tops, and rule impact', () => {
    const md = formatDigestMarkdown(sample);
    expect(md).toContain('# NightOwl digest since 2026-11-05');
    expect(md).toContain('New failures (not dismissed): **3**');
    expect(md).toContain('Open for review (flagged): **2**');
    expect(md).toContain('- logic: 2');
    expect(md).toContain('Rule impact (r1): 5 → 2 (delta -3)');
    expect(md).toMatch(/Does not email\/Slack/i);
  });

  it('says none recorded when no rule impact', () => {
    expect(formatDigestMarkdown({ ...sample, ruleImpact: null })).toContain('Rule impact: none recorded');
    expect(formatDigestMarkdown({ ...sample, ruleImpact: 'unavailable' })).toContain('Rule impact: n/a');
  });
});

describe('formatDigestHtml', () => {
  it('is self-contained without CDN urls', () => {
    const html = formatDigestHtml(sample);
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('Open for review (flagged)');
    expect(html).toContain(': 2</li>');
    expect(html).toContain('logic');
    expect(html).not.toMatch(/https?:\/\//);
  });
});

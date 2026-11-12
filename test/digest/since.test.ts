import { describe, expect, it } from 'vitest';
import { DEFAULT_DIGEST_LOOKBACK_DAYS, parseDigestSince, sinceDaysAgo } from '../../src/digest/since.js';

const NOW = new Date('2026-11-12T15:30:00.000Z');

describe('parseDigestSince', () => {
  it('defaults to 7 days before today UTC', () => {
    expect(parseDigestSince(undefined, NOW)).toEqual({
      since: sinceDaysAgo(NOW, DEFAULT_DIGEST_LOOKBACK_DAYS),
    });
    expect(parseDigestSince(undefined, NOW)).toEqual({ since: '2026-11-05T00:00:00.000Z' });
  });

  it('accepts YYYY-MM-DD', () => {
    expect(parseDigestSince('2026-11-01', NOW)).toEqual({ since: '2026-11-01T00:00:00.000Z' });
  });

  it('accepts relative Nd', () => {
    expect(parseDigestSince('7d', NOW)).toEqual({ since: '2026-11-05T00:00:00.000Z' });
    expect(parseDigestSince('1d', NOW)).toEqual({ since: '2026-11-11T00:00:00.000Z' });
  });

  it('rejects invalid values', () => {
    expect(parseDigestSince('nope', NOW)).toMatchObject({ error: expect.stringMatching(/invalid --since/i) });
    expect(parseDigestSince('1w', NOW)).toMatchObject({ error: expect.stringMatching(/invalid --since/i) });
    expect(parseDigestSince('0d', NOW)).toMatchObject({ error: expect.stringMatching(/relative days/i) });
    expect(parseDigestSince('366d', NOW)).toMatchObject({ error: expect.stringMatching(/relative days/i) });
    expect(parseDigestSince('', NOW)).toMatchObject({ error: expect.stringMatching(/empty/i) });
  });
});

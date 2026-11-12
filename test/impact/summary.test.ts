import { describe, expect, it } from 'vitest';
import { formatRuleImpactLine, resolveRuleImpactSummary } from '../../src/impact/summary.js';
import type { Store } from '../../src/storage/store.js';

describe('formatRuleImpactLine', () => {
  it('formats none recorded', () => {
    expect(formatRuleImpactLine(null)).toBe('Rule impact: none recorded');
  });

  it('formats unavailable', () => {
    expect(formatRuleImpactLine('unavailable')).toBe('Rule impact: n/a');
  });

  it('formats label with negative delta', () => {
    expect(formatRuleImpactLine({ label: 'r1', before: 5, after: 2, delta: -3 })).toBe(
      'Rule impact (r1): 5 → 2 (delta -3)',
    );
  });

  it('formats positive delta with plus sign', () => {
    expect(formatRuleImpactLine({ label: 'r2', before: 1, after: 3, delta: 2 })).toBe(
      'Rule impact (r2): 1 → 3 (delta +2)',
    );
  });
});

describe('resolveRuleImpactSummary', () => {
  it('returns null when no mark', () => {
    const store = {
      getLatestRuleApplication: () => null,
    } as unknown as Store;
    expect(resolveRuleImpactSummary(store, '2026-11-12T00:00:00.000Z')).toBeNull();
  });

  it('returns unavailable when compare throws', () => {
    const store = {
      getLatestRuleApplication: () => ({
        id: 1,
        label: 'r1',
        appliedAt: '2026-11-01T00:00:00.000Z',
        filters: { categories: null, agents: null, modules: null, depth: 2 },
        baseline: { total: 0, byCategory: {} },
      }),
      countFailuresInWindow: () => {
        throw new Error('boom');
      },
    } as unknown as Store;
    expect(resolveRuleImpactSummary(store, '2026-11-12T00:00:00.000Z')).toBe('unavailable');
  });
});

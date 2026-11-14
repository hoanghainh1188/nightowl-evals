import { describe, expect, it } from 'vitest';
import type { ClusterableFailure } from '../../src/cluster/types.js';
import {
  defaultBaselineSince,
  measureRepeatOutcomes,
  resolveBaselineSince,
} from '../../src/report/repeat.js';

function failure(
  partial: Partial<ClusterableFailure> & Pick<ClusterableFailure, 'id' | 'aiContent' | 'finalContent'>,
): ClusterableFailure {
  return {
    filePath: 'src/a.ts',
    category: 'logic',
    agent: 'claude-code',
    status: 'flagged',
    ...partial,
  };
}

describe('measureRepeatOutcomes', () => {
  it('counts a key as repeat when it appears in baseline and window', () => {
    const shared = failure({ id: 1, aiContent: 'ai', finalContent: 'final' });
    const onlyWindow = failure({
      id: 2,
      aiContent: 'other',
      finalContent: 'other-final',
      filePath: 'src/b.ts',
    });
    const result = measureRepeatOutcomes({
      baseline: [shared],
      window: [shared, onlyWindow],
      baselineSince: '2026-10-01T00:00:00.000Z',
      windowSince: '2026-11-01T00:00:00.000Z',
    });
    expect(result).toMatchObject({
      repeatCount: 1,
      newCount: 1,
      repeatRate: 0.5,
      baselineSince: '2026-10-01T00:00:00.000Z',
      windowSince: '2026-11-01T00:00:00.000Z',
    });
  });

  it('treats keys only in window as new', () => {
    const row = failure({ id: 1, aiContent: 'x', finalContent: 'y' });
    const result = measureRepeatOutcomes({
      baseline: [],
      window: [row],
      baselineSince: null,
      windowSince: '2026-11-01T00:00:00.000Z',
    });
    expect(result.repeatCount).toBe(0);
    expect(result.newCount).toBe(1);
    expect(result.repeatRate).toBe(0);
  });

  it('ignores dismissed failures', () => {
    const dismissed = failure({
      id: 1,
      aiContent: 'ai',
      finalContent: 'final',
      status: 'dismissed',
    });
    const active = failure({ id: 2, aiContent: 'ai', finalContent: 'final' });
    const result = measureRepeatOutcomes({
      baseline: [dismissed],
      window: [active],
      baselineSince: '2026-10-01T00:00:00.000Z',
      windowSince: '2026-11-01T00:00:00.000Z',
    });
    expect(result.repeatCount).toBe(0);
    expect(result.newCount).toBe(1);
  });

  it('returns null rate when the window has no keys', () => {
    const result = measureRepeatOutcomes({
      baseline: [failure({ id: 1, aiContent: 'a', finalContent: 'b' })],
      window: [],
      baselineSince: '2026-10-01T00:00:00.000Z',
      windowSince: '2026-11-01T00:00:00.000Z',
    });
    expect(result).toMatchObject({ repeatCount: 0, newCount: 0, repeatRate: null });
  });

  it('counts distinct keys once even with many failures', () => {
    const a = failure({ id: 1, aiContent: 'same', finalContent: 'same' });
    const b = failure({ id: 2, aiContent: 'same', finalContent: 'same' });
    const result = measureRepeatOutcomes({
      baseline: [a],
      window: [a, b],
      baselineSince: 't0',
      windowSince: 't1',
    });
    expect(result.repeatCount).toBe(1);
    expect(result.newCount).toBe(0);
    expect(result.repeatRate).toBe(1);
  });
});

describe('defaultBaselineSince / resolveBaselineSince', () => {
  it('mirrors window duration before since', () => {
    const now = new Date('2026-11-15T00:00:00.000Z');
    const windowSince = '2026-11-01T00:00:00.000Z';
    expect(defaultBaselineSince(windowSince, now)).toBe('2026-10-18T00:00:00.000Z');
  });

  it('uses explicit baseline-since when valid and before since', () => {
    const resolved = resolveBaselineSince({
      windowSince: '2026-11-01T00:00:00.000Z',
      baselineSinceOption: '2026-10-01',
      now: new Date('2026-11-15T00:00:00.000Z'),
    });
    expect(resolved).toEqual({ baselineSince: '2026-10-01T00:00:00.000Z' });
  });

  it('rejects invalid or non-before baseline-since', () => {
    expect(
      resolveBaselineSince({
        windowSince: '2026-11-01T00:00:00.000Z',
        baselineSinceOption: 'nope',
        now: new Date(),
      }),
    ).toEqual({ error: 'invalid --baseline-since date (use YYYY-MM-DD): nope' });
    expect(
      resolveBaselineSince({
        windowSince: '2026-11-01T00:00:00.000Z',
        baselineSinceOption: '2026-11-01',
        now: new Date(),
      }),
    ).toEqual({ error: '--baseline-since must be before --since' });
  });

  it('uses empty baseline when there is no window since', () => {
    expect(
      resolveBaselineSince({
        windowSince: null,
        baselineSinceOption: undefined,
        now: new Date('2026-11-15T00:00:00.000Z'),
      }),
    ).toEqual({ baselineSince: null });
  });
});

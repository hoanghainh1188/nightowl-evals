import { describe, expect, it } from 'vitest';
import { renderFrame } from '../../src/review/tui/render.js';
import { applyKey, applyMarkResult, initialTuiState } from '../../src/review/tui/session.js';
import type { FailureForReview } from '../../src/storage/review-queries.js';

function failure(partial: Partial<FailureForReview> & Pick<FailureForReview, 'id'>): FailureForReview {
  return Object.freeze({
    createdAt: '2026-11-04T10:00:00.000Z',
    filePath: 'src/a.ts',
    commitSha: 'abc',
    source: 'manual-fix',
    agent: 'claude-code',
    status: 'flagged',
    category: 'logic',
    categoryReason: 'bug',
    categoryConfidence: 0.9,
    prompt: 'fix',
    feedback: null,
    aiContent: 'ai\n',
    finalContent: 'dev\n',
    ...partial,
  });
}

describe('tui render + state', () => {
  it('sanitizes ESC from failure content and colors diff markers', () => {
    const items = [
      failure({
        id: 1,
        aiContent: 'line\u001b[31msecret\n',
        finalContent: 'line fixed\n',
      }),
    ];
    const frame = renderFrame({
      items,
      index: 0,
      showDiff: true,
      statusLabel: 'flagged',
      message: null,
      rows: 40,
      columns: 80,
    });
    expect(frame).toContain('nightowl review');
    expect(frame).toContain('↑/↓');
    expect(frame).not.toMatch(/\u001b\[31msecret/);
    expect(frame).toContain('\u001b[32m'); // green for additions from NightOwl
  });

  it('navigates and toggles diff', () => {
    let state = initialTuiState([failure({ id: 1 }), failure({ id: 2 })], 'flagged');
    state = applyKey(state, { type: 'down' });
    expect(state.index).toBe(1);
    state = applyKey(state, { type: 'toggleDiff' });
    expect(state.showDiff).toBe(true);
    state = applyKey(state, { type: 'quit' });
    expect(state.done).toBe(true);
  });

  it('clamps index after mark refresh', () => {
    const state = initialTuiState([failure({ id: 1 }), failure({ id: 2 })], 'flagged');
    const moved = applyKey(state, { type: 'down' });
    const next = applyMarkResult(moved, [failure({ id: 1 })], 'Confirmed #2');
    expect(next.items).toHaveLength(1);
    expect(next.index).toBe(0);
    expect(next.message).toContain('Confirmed');
  });
});

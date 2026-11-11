import { describe, expect, it } from 'vitest';
import { decideNoiseStatus, isSafeAutoNoise } from '../../src/noise/decide.js';
import { scoreNoise } from '../../src/noise/score.js';

describe('scoreNoise', () => {
  it('detects comment-only changes', () => {
    const ai = 'export const a = 1;\n';
    const final = 'export const a = 1; // tweak\n';
    const scored = scoreNoise(ai, final, 'src/a.ts');
    expect(scored.reasons).toContain('comment-only');
    expect(scored.score).toBeGreaterThanOrEqual(0.9);
  });

  it('scores normal logic edits low/without safe reasons', () => {
    const scored = scoreNoise('export const a = 1;\n', 'export const a = 2;\n', 'src/a.ts');
    expect(scored.reasons).not.toContain('comment-only');
    expect(scored.score).toBe(0);
  });

  it('detects format-only punctuation/whitespace churn', () => {
    const scored = scoreNoise('const a=1\n', 'const a = 1;\n', 'src/a.ts');
    expect(scored.reasons).toContain('format-only');
    expect(scored.score).toBeGreaterThan(0);
  });

  it('boosts with learned dismiss stats', () => {
    const base = scoreNoise('export const a = 1;\n', 'export const a = 1; // x\n', 'src/a.ts');
    const learned = scoreNoise('export const a = 1;\n', 'export const a = 1; // x\n', 'src/a.ts', [
      { reasonKey: 'comment-only', dismissCount: 8, confirmCount: 0 },
    ]);
    expect(learned.reasons).toContain('learned-dismiss');
    expect(learned.score).toBeGreaterThan(base.score);
  });
});

describe('decideNoiseStatus', () => {
  it('auto-dismisses comment-only as safe noise', () => {
    const decision = decideNoiseStatus({ score: 0.9, reasons: ['comment-only'] });
    expect(isSafeAutoNoise(decision.reasons)).toBe(true);
    expect(decision.status).toBe('dismissed');
    expect(decision.reasons).toContain('auto-noise');
  });

  it('keeps format-only flagged', () => {
    const decision = decideNoiseStatus({ score: 0.55, reasons: ['format-only'] });
    expect(decision.status).toBe('flagged');
    expect(decision.reasons).not.toContain('auto-noise');
  });
});

import { describe, expect, it } from 'vitest';
import { hasScorableChange, PASS_SCORE, scoreOutput } from '../../src/eval/score.js';

const rejected = 'function isAdult(age) {\n  return age > 18;\n}\n';
const expected = 'function isAdult(age) {\n  return age >= 18;\n}\n';

describe('scoreOutput', () => {
  it('gives 1 to the developer version and 0 to the rejected one', () => {
    expect(scoreOutput({ rejected, expected, output: expected })).toEqual({ coverage: 1, repeat: 0, score: 1, pass: true });
    expect(scoreOutput({ rejected, expected, output: rejected })).toEqual({ coverage: 0, repeat: 1, score: 0, pass: false });
  });

  it('ignores indentation and blank lines', () => {
    const output = 'function isAdult(age) {\n\n      return age >= 18;\n}';
    expect(scoreOutput({ rejected, expected, output }).score).toBe(1);
  });

  it('scores a partial fix', () => {
    const r = 'a\nb\nc\n';
    const e = 'a\nB\nC\n';
    // Keeps the defect on c, fixes b.
    expect(scoreOutput({ rejected: r, expected: e, output: 'a\nB\nc\n' })).toEqual({
      coverage: 0.5,
      repeat: 0.5,
      score: 0.25,
      pass: false,
    });
  });

  it('counts repeated lines as many times as they appear', () => {
    const r = 'x\n';
    const e = 'x\ny\ny\n';
    expect(scoreOutput({ rejected: r, expected: e, output: 'x\ny\n' }).coverage).toBe(0.5);
    expect(scoreOutput({ rejected: r, expected: e, output: 'x\ny\ny\ny\n' }).coverage).toBe(1);
  });

  it('treats a fix that only removes lines as fully covered', () => {
    const r = 'a\ndebugger;\nb\n';
    const e = 'a\nb\n';
    expect(scoreOutput({ rejected: r, expected: e, output: 'a\nb\n' })).toEqual({ coverage: 1, repeat: 0, score: 1, pass: true });
  });

  it('treats a fix that only adds lines as never repeating a defect', () => {
    expect(scoreOutput({ rejected: 'a\n', expected: 'a\nb\n', output: 'a\n' })).toEqual({ coverage: 0, repeat: 0, score: 0, pass: false });
  });

  it('decides the pass exactly at 0.5, without floating point error', () => {
    // 6 of 7 added lines, 5 of 12 removed lines kept: 6/7 × 7/12 = 0.5 exactly.
    const added = Array.from({ length: 7 }, (_, i) => `add${i}`);
    const removed = Array.from({ length: 12 }, (_, i) => `rm${i}`);
    const out = [...added.slice(0, 6), ...removed.slice(0, 5)].join('\n');
    const result = scoreOutput({ rejected: removed.join('\n'), expected: added.join('\n'), output: out });
    expect(result.pass).toBe(true);
    expect(result.score).toBeCloseTo(0.5, 12);
  });

  it('knows when there is nothing to score', () => {
    expect(hasScorableChange('a\n  b\n', 'a\nb\n\n')).toBe(false);
    expect(hasScorableChange('a\n', 'b\n')).toBe(true);
  });

  it('passes from 0.5 up', () => {
    expect(PASS_SCORE).toBe(0.5);
    expect(scoreOutput({ rejected: 'a\n', expected: 'b\nc\n', output: 'b\n' })).toMatchObject({ score: 0.5, pass: true });
  });
});

import { describe, expect, it } from 'vitest';
import {
  evalLoopNextStepsAfterEval,
  evalLoopNextStepsAfterExport,
  evalLoopNextStepsAfterSuggest,
} from '../../src/eval/loop-hints.js';

describe('eval loop hints', () => {
  it('after export points at eval with --label and digest/dashboard', () => {
    const text = evalLoopNextStepsAfterExport('.nightowl/export/evals.jsonl');
    expect(text).toContain('Next:');
    expect(text).toContain('nightowl eval');
    expect(text).toContain('--label');
    expect(text).toContain('.nightowl/export/evals.jsonl');
    expect(text).toMatch(/digest|dashboard/);
  });

  it('after suggest points at export/eval loop', () => {
    const text = evalLoopNextStepsAfterSuggest();
    expect(text).toContain('Next:');
    expect(text).toMatch(/export|eval/);
    expect(text).toContain('--label');
  });

  it('after eval points at eval-compare and digest/dashboard', () => {
    const text = evalLoopNextStepsAfterEval();
    expect(text).toContain('Next:');
    expect(text).toContain('eval-compare');
    expect(text).toMatch(/digest|dashboard/);
  });
});

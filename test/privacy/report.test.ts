import { describe, expect, it } from 'vitest';
import { redactPathsInReport } from '../../src/privacy/index.js';
import type { Report } from '../../src/report/build.js';
import { EMPTY_REPEAT } from '../../src/report/repeat.js';

const base: Report = {
  generatedAt: '2026-11-12T12:00:00.000Z',
  since: null,
  depth: 3,
  agents: null,
  total: 1,
  unclassified: 0,
  dismissed: 0,
  changedRate: { failures: 0, checked: 0, rate: null },
  byCategory: { logic: 1 },
  bySource: { 'manual-fix': 1, 'ai-self-fix': 0 },
  byStatus: { confirmed: 0, dismissed: 0, flagged: 1 },
  byAgent: { 'claude-code': 1 },
  headToHead: [],
  byModule: [{ module: 'src/hooks/git', failures: 1 }],
  byWeek: [],
  signals: { ciFail: 0, prReview: 0, revert: 0 },
  noise: { reviewRate: null, autoNoise: 0, sample: { confirmed: 0, dismissed: 0 } },
  clusters: [
    {
      key: 'k',
      category: 'logic',
      module: 'src/hooks/git',
      agent: 'claude-code',
      fingerprint: 'abcd',
      count: 2,
      sampleIds: [1],
      samplePaths: ['src/hooks/git/run.ts'],
    },
  ],
  repeat: EMPTY_REPEAT,
};

describe('redactPathsInReport', () => {
  it('coarsens deep module and sample paths', () => {
    const out = redactPathsInReport(base);
    expect(out.byModule[0]!.module).toBe('src/**/git');
    expect(out.clusters[0]!.module).toBe('src/**/git');
    expect(out.clusters[0]!.samplePaths[0]).toBe('src/**/run.ts');
  });
});

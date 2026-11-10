import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { compareRuleImpact, formatImpactJson, formatImpactText } from '../../src/impact/compare.js';
import { shiftIsoDays } from '../../src/impact/count.js';
import { openStore } from '../../src/storage/store.js';
import { seed } from '../helpers/seed-failures.js';
import { createFakeRepo, type TempDir } from '../helpers/temp-repo.js';

describe('rule impact compare helpers', () => {
  let repo: TempDir;
  beforeEach(async () => {
    repo = await createFakeRepo();
  });
  afterEach(() => repo.cleanup());

  it('formats text with incomplete after window and positive delta', async () => {
    await seed(repo.path, [
      { filePath: 'src/a.ts', category: 'convention', createdAt: '2026-10-20T00:00:00.000Z' },
      { filePath: 'src/b.ts', category: 'convention', createdAt: '2026-11-05T00:00:00.000Z' },
      { filePath: 'src/c.ts', category: 'convention', createdAt: '2026-11-06T00:00:00.000Z' },
    ]);
    const store = await openStore({ cwd: repo.path });
    try {
      const application = store.upsertRuleApplication({
        label: 'r1',
        appliedAt: '2026-11-01T00:00:00.000Z',
        filters: { categories: ['convention'], agents: null, modules: null, depth: 2 },
        baseline: { total: 1, byCategory: { convention: 1 } },
      });
      const comparison = compareRuleImpact(store, application, {
        beforeDays: 14,
        afterDays: 14,
        now: '2026-11-07T00:00:00.000Z',
      });
      expect(comparison.afterIncomplete).toBe(true);
      expect(comparison.delta).toBeGreaterThan(0);
      const text = formatImpactText(comparison);
      expect(text).toMatch(/\+/);
      expect(text).toMatch(/incomplete/i);
      expect(text).toMatch(/Baseline total at mark: 1/);
      const json = JSON.parse(formatImpactJson(comparison)) as { after: { incomplete: boolean }; delta: number };
      expect(json.after.incomplete).toBe(true);
      expect(json.delta).toBe(comparison.delta);
    } finally {
      store.close();
    }
  });

  it('uses complete after window when enough time has passed', async () => {
    await seed(repo.path, [{ filePath: 'src/a.ts', category: 'logic', createdAt: '2026-10-25T00:00:00.000Z' }]);
    const store = await openStore({ cwd: repo.path });
    try {
      const application = store.upsertRuleApplication({
        label: 'r2',
        appliedAt: '2026-11-01T00:00:00.000Z',
        filters: { categories: null, agents: null, modules: null, depth: 2 },
        baseline: { total: 1, byCategory: { logic: 1 } },
      });
      const comparison = compareRuleImpact(store, application, {
        now: '2026-11-20T00:00:00.000Z',
      });
      expect(comparison.afterIncomplete).toBe(false);
      expect(comparison.afterTo).toBe(shiftIsoDays(application.appliedAt, 14));
      expect(formatImpactText(comparison)).not.toMatch(/incomplete/i);
    } finally {
      store.close();
    }
  });

  it('rejects invalid ISO in shiftIsoDays via count re-export', () => {
    expect(() => shiftIsoDays('not-a-date', 1)).toThrow(/invalid ISO/);
  });
});

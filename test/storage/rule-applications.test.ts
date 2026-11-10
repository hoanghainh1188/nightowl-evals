import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openStore } from '../../src/storage/store.js';
import { createFakeRepo, type TempDir } from '../helpers/temp-repo.js';
import { seed } from '../helpers/seed-failures.js';

describe('rule_applications store', () => {
  let repo: TempDir;
  beforeEach(async () => {
    repo = await createFakeRepo();
  });
  afterEach(() => repo.cleanup());

  it('upserts by label and returns latest', async () => {
    const store = await openStore({ cwd: repo.path });
    const first = store.upsertRuleApplication({
      label: 'convention-naming',
      appliedAt: '2026-11-01T00:00:00.000Z',
      filters: { categories: ['convention'], agents: null, modules: null, depth: 2 },
      baseline: { total: 3, byCategory: { convention: 3 } },
    });
    expect(first.id).toBeGreaterThan(0);
    const second = store.upsertRuleApplication({
      label: 'convention-naming',
      appliedAt: '2026-11-10T00:00:00.000Z',
      filters: { categories: ['convention'], agents: null, modules: null, depth: 2 },
      baseline: { total: 1, byCategory: { convention: 1 } },
    });
    expect(second.id).toBe(first.id);
    expect(store.listRuleApplications()).toHaveLength(1);
    expect(store.getLatestRuleApplication()?.appliedAt).toBe('2026-11-10T00:00:00.000Z');
    expect(store.getRuleApplicationByLabel('convention-naming')?.baseline.total).toBe(1);
    store.close();
  });

  it('counts failures in a window with category filter', async () => {
    await seed(repo.path, [
      { filePath: 'src/a.ts', category: 'convention', createdAt: '2026-11-02T00:00:00.000Z' },
      { filePath: 'src/b.ts', category: 'logic', createdAt: '2026-11-02T00:00:00.000Z' },
      { filePath: 'src/c.ts', category: 'convention', createdAt: '2026-11-08T00:00:00.000Z', status: 'dismissed' },
    ]);
    const store = await openStore({ cwd: repo.path, readOnly: true });
    try {
      const counts = store.countFailuresInWindow({
        categories: ['convention'],
        agents: null,
        modules: null,
        depth: 2,
        fromInclusive: '2026-11-01T00:00:00.000Z',
        toExclusive: '2026-11-10T00:00:00.000Z',
      });
      expect(counts.total).toBe(1);
      expect(counts.byCategory).toEqual({ convention: 1 });
    } finally {
      store.close();
    }
  });

  it('filters by module and agent', async () => {
    await seed(repo.path, [
      { filePath: 'pkg/a.ts', category: 'convention', createdAt: '2026-11-02T00:00:00.000Z', agent: 'cursor' },
      { filePath: 'other/b.ts', category: 'convention', createdAt: '2026-11-02T00:00:00.000Z', agent: 'claude-code' },
      { filePath: 'pkg/c.ts', category: 'convention', createdAt: '2026-11-02T00:00:00.000Z', agent: 'cursor' },
    ]);
    const store = await openStore({ cwd: repo.path, readOnly: true });
    try {
      const byModule = store.countFailuresInWindow({
        categories: null,
        agents: null,
        modules: ['pkg'],
        depth: 1,
        fromInclusive: null,
        toExclusive: null,
      });
      expect(byModule.total).toBe(2);
      const byAgent = store.countFailuresInWindow({
        categories: ['convention'],
        agents: ['cursor'],
        modules: null,
        depth: 2,
        fromInclusive: null,
        toExclusive: null,
      });
      expect(byAgent.total).toBe(2);
      expect(store.getRuleApplicationById(9999)).toBeNull();
    } finally {
      store.close();
    }
  });
});

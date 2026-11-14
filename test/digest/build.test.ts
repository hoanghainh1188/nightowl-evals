import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildDigest } from '../../src/digest/build.js';
import { openStore } from '../../src/storage/store.js';
import { seed } from '../helpers/seed-failures.js';
import { createFakeRepo, type TempDir } from '../helpers/temp-repo.js';

describe('buildDigest', () => {
  let repo: TempDir;
  beforeEach(async () => {
    repo = await createFakeRepo();
  });
  afterEach(() => repo.cleanup());

  it('aggregates totals, tops, flagged, and null rule impact', async () => {
    await seed(repo.path, [
      { filePath: 'src/a.ts', category: 'logic', status: 'flagged', createdAt: '2026-11-10T00:00:00.000Z' },
      { filePath: 'src/b.ts', category: 'logic', status: 'confirmed', createdAt: '2026-11-10T00:00:00.000Z' },
      { filePath: 'src/c.ts', category: 'convention', status: 'flagged', createdAt: '2026-11-10T00:00:00.000Z' },
    ]);
    const store = await openStore({ cwd: repo.path, readOnly: true });
    try {
      const digest = buildDigest({
        store,
        since: '2026-11-01T00:00:00.000Z',
        depth: 2,
        generatedAt: '2026-11-12T12:00:00.000Z',
      });
      expect(digest.total).toBe(3);
      expect(digest.flagged).toBe(2);
      expect(digest.topCategories[0]).toEqual({ name: 'logic', count: 2 });
      expect(digest.ruleImpact).toBeNull();
      expect(digest.evalLoop).toEqual({ kind: 'none' });
    } finally {
      store.close();
    }
  });

  it('uses injected labeled eval loop', async () => {
    await seed(repo.path, [{ filePath: 'src/a.ts', createdAt: '2026-11-10T00:00:00.000Z' }]);
    const store = await openStore({ cwd: repo.path, readOnly: true });
    try {
      const digest = buildDigest({
        store,
        since: '2026-11-01T00:00:00.000Z',
        depth: 2,
        generatedAt: '2026-11-12T12:00:00.000Z',
        evalLoop: {
          kind: 'ok',
          label: 'prompt-v3',
          baselineLabel: null,
          oneLine: 'prompt-v3; haiku pass 1/1 mean 0.90',
        },
      });
      expect(digest.evalLoop.kind).toBe('ok');
      if (digest.evalLoop.kind !== 'ok') return;
      expect(digest.evalLoop.label).toBe('prompt-v3');
    } finally {
      store.close();
    }
  });
});

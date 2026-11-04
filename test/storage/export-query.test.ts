import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openStore, type Store } from '../../src/storage/store.js';
import { seed } from '../helpers/seed-failures.js';
import { createFakeRepo, type TempDir } from '../helpers/temp-repo.js';

describe('failures to export', () => {
  let repo: TempDir;
  let store: Store;

  beforeEach(async () => {
    repo = await createFakeRepo();
    await seed(repo.path, [
      { filePath: 'a.ts', category: 'logic', createdAt: '2026-11-01T00:00:00.000Z', prompt: 'p1', reason: 'r', confidence: 0.5 },
      { filePath: 'b.ts', category: 'convention', createdAt: '2026-11-03T00:00:00.000Z' },
      { filePath: 'c.ts', category: null, createdAt: '2026-11-04T00:00:00.000Z' },
      { filePath: 'd.ts', category: 'logic', status: 'dismissed' },
    ]);
    store = await openStore({ cwd: repo.path });
  });
  afterEach(async () => {
    store.close();
    await repo.cleanup();
  });

  const paths = (since: string | null, categories: readonly string[] | null) =>
    store.listFailuresToExport({ since, categories }).map((f) => f.filePath);

  it('returns failures not dismissed, oldest first, with prompt and classification', () => {
    const all = store.listFailuresToExport({ since: null, categories: null });
    expect(all.map((f) => f.filePath)).toEqual(['a.ts', 'b.ts', 'c.ts']);
    expect(all[0]).toMatchObject({ prompt: 'p1', category: 'logic', categoryReason: 'r', categoryConfidence: 0.5, aiContent: 'ai\n' });
    expect(all[1]?.prompt).toBeNull();
  });

  it('filters by date and by categories, including unclassified', () => {
    expect(paths('2026-11-03T00:00:00.000Z', null)).toEqual(['b.ts', 'c.ts']);
    expect(paths(null, ['logic'])).toEqual(['a.ts']);
    expect(paths(null, ['convention', 'unclassified'])).toEqual(['b.ts', 'c.ts']);
    expect(paths(null, [])).toEqual([]);
  });
});

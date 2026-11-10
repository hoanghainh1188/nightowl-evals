import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openStore, type Store } from '../../src/storage/store.js';
import { seed } from '../helpers/seed-failures.js';
import { createFakeRepo, type TempDir } from '../helpers/temp-repo.js';

describe('listFailuresForRegressions', () => {
  let repo: TempDir;
  let store: Store;

  beforeEach(async () => {
    repo = await createFakeRepo();
    await seed(repo.path, [
      {
        filePath: 'src/a.ts',
        category: 'logic',
        status: 'confirmed',
        createdAt: '2026-11-01T00:00:00.000Z',
        agent: 'claude-code',
      },
      {
        filePath: 'src/b.ts',
        category: 'convention',
        status: 'confirmed',
        createdAt: '2026-11-03T00:00:00.000Z',
        agent: 'cursor',
      },
      {
        filePath: 'src/c.ts',
        category: 'logic',
        status: 'flagged',
        createdAt: '2026-11-04T00:00:00.000Z',
      },
      {
        filePath: 'src/d.ts',
        category: 'logic',
        status: 'dismissed',
        createdAt: '2026-11-04T00:00:00.000Z',
      },
    ]);
    store = await openStore({ cwd: repo.path });
  });

  afterEach(async () => {
    store.close();
    await repo.cleanup();
  });

  it('filters by status, category, agent, since, and limit', () => {
    const confirmed = store.listFailuresForRegressions({
      since: null,
      statuses: ['confirmed'],
      categories: null,
      agents: null,
      limit: 20,
    });
    expect(confirmed.map((f) => f.filePath)).toEqual(['src/a.ts', 'src/b.ts']);

    const logic = store.listFailuresForRegressions({
      since: null,
      statuses: ['confirmed'],
      categories: ['logic'],
      agents: null,
      limit: 20,
    });
    expect(logic.map((f) => f.filePath)).toEqual(['src/a.ts']);

    const agents = store.listFailuresForRegressions({
      since: null,
      statuses: ['confirmed'],
      categories: null,
      agents: ['cursor'],
      limit: 20,
    });
    expect(agents.map((f) => f.filePath)).toEqual(['src/b.ts']);

    const since = store.listFailuresForRegressions({
      since: '2026-11-03T00:00:00.000Z',
      statuses: ['confirmed'],
      categories: null,
      agents: null,
      limit: 20,
    });
    expect(since.map((f) => f.filePath)).toEqual(['src/b.ts']);

    const limited = store.listFailuresForRegressions({
      since: null,
      statuses: ['confirmed'],
      categories: null,
      agents: null,
      limit: 1,
    });
    expect(limited.map((f) => f.filePath)).toEqual(['src/a.ts']);
  });
});

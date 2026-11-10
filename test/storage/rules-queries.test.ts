import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openStore, type Store } from '../../src/storage/store.js';
import { seed } from '../helpers/seed-failures.js';
import { createFakeRepo, type TempDir } from '../helpers/temp-repo.js';

describe('listFailuresForRules', () => {
  let repo: TempDir;
  let store: Store;

  beforeEach(async () => {
    repo = await createFakeRepo();
    await seed(repo.path, [
      {
        filePath: 'src/a.ts',
        category: 'convention',
        status: 'confirmed',
        createdAt: '2026-11-01T00:00:00.000Z',
        agent: 'claude-code',
      },
      {
        filePath: 'src/b.ts',
        category: 'missing-context',
        status: 'confirmed',
        createdAt: '2026-11-03T00:00:00.000Z',
        agent: 'cursor',
      },
      {
        filePath: 'src/c.ts',
        category: 'convention',
        status: 'flagged',
        createdAt: '2026-11-04T00:00:00.000Z',
      },
      {
        filePath: 'src/d.ts',
        category: 'logic',
        status: 'confirmed',
        createdAt: '2026-11-04T00:00:00.000Z',
      },
      {
        filePath: 'src/e.ts',
        category: 'convention',
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

  it('filters by status, category, agent, and since', () => {
    const confirmed = store.listFailuresForRules({
      since: null,
      statuses: ['confirmed'],
      categories: ['convention', 'missing-context'],
      agents: null,
    });
    expect(confirmed.map((f) => f.filePath)).toEqual(['src/a.ts', 'src/b.ts']);

    const since = store.listFailuresForRules({
      since: '2026-11-03T00:00:00.000Z',
      statuses: ['confirmed'],
      categories: ['convention', 'missing-context'],
      agents: null,
    });
    expect(since.map((f) => f.filePath)).toEqual(['src/b.ts']);

    const agents = store.listFailuresForRules({
      since: null,
      statuses: ['confirmed'],
      categories: ['convention', 'missing-context'],
      agents: ['cursor'],
    });
    expect(agents.map((f) => f.filePath)).toEqual(['src/b.ts']);

    const flagged = store.listFailuresForRules({
      since: null,
      statuses: ['flagged'],
      categories: ['convention'],
      agents: null,
    });
    expect(flagged.map((f) => f.filePath)).toEqual(['src/c.ts']);
  });

  it('returns nothing when filters are empty', () => {
    expect(
      store.listFailuresForRules({
        since: null,
        statuses: [],
        categories: ['convention'],
        agents: null,
      }),
    ).toEqual([]);
  });
});

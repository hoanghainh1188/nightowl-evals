import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openStore, type Store } from '../../src/storage/store.js';
import { seed } from '../helpers/seed-failures.js';
import { createFakeRepo, type TempDir } from '../helpers/temp-repo.js';

describe('report queries', () => {
  let repo: TempDir;
  let store: Store;

  beforeEach(async () => {
    repo = await createFakeRepo();
    await seed(
      repo.path,
      [
        { filePath: 'src/a.ts', category: 'logic', createdAt: '2026-11-02T09:00:00.000Z' },
        { filePath: 'src/a.ts', category: 'logic', createdAt: '2026-11-02T18:00:00.000Z' },
        { filePath: 'src/b.ts', status: 'dismissed', createdAt: '2026-11-03T09:00:00.000Z' },
      ],
      [
        { createdAt: '2026-11-01T09:00:00.000Z', outcome: 'not-a-failure' },
        { createdAt: '2026-11-02T09:00:00.000Z', outcome: 'failure' },
        { createdAt: '2026-11-02T10:00:00.000Z', outcome: 'superseded' },
      ],
    );
    store = await openStore({ cwd: repo.path });
  });
  afterEach(async () => {
    store.close();
    await repo.cleanup();
  });

  it('groups failures by file, category, status and UTC day', () => {
    expect(store.countFailuresForReport(null)).toEqual([
      { filePath: 'src/a.ts', category: 'logic', status: 'flagged', day: '2026-11-02', count: 2 },
      { filePath: 'src/b.ts', category: null, status: 'dismissed', day: '2026-11-03', count: 1 },
    ]);
  });

  it('counts judged checks by day and leaves superseded ones out', () => {
    expect(store.countChecksForReport(null)).toEqual([
      { day: '2026-11-01', outcome: 'not-a-failure', count: 1 },
      { day: '2026-11-02', outcome: 'failure', count: 1 },
    ]);
  });

  it('filters both by date', () => {
    const since = '2026-11-03T00:00:00.000Z';
    expect(store.countFailuresForReport(since).map((row) => row.filePath)).toEqual(['src/b.ts']);
    expect(store.countChecksForReport('2026-11-02T00:00:00.000Z')).toHaveLength(1);
  });
});

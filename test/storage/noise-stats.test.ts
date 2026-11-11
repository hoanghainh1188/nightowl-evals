import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scoreNoise } from '../../src/noise/score.js';
import { openStore, type Store } from '../../src/storage/store.js';
import { seed } from '../helpers/seed-failures.js';
import { createFakeRepo, type TempDir } from '../helpers/temp-repo.js';

describe('noise_stats learning', () => {
  let repo: TempDir;
  let store: Store;

  beforeEach(async () => {
    repo = await createFakeRepo();
    const ids = await seed(repo.path, [
      {
        filePath: 'a.ts',
        status: 'flagged',
        noiseScore: 0.55,
        noiseReasons: 'format-only',
      },
    ]);
    store = await openStore({ cwd: repo.path });
    store.setFailureStatus(ids, 'dismissed');
  });
  afterEach(async () => {
    store.close();
    await repo.cleanup();
  });

  it('boosts scoreNoise when dismiss history exists for a reason', () => {
    const stats = store.listNoiseStats();
    expect(stats).toEqual([expect.objectContaining({ reasonKey: 'format-only', dismissCount: 1 })]);
    const learned = scoreNoise('const a=1\n', 'const a = 1;\n', 'src/a.ts', stats);
    expect(learned.reasons).toContain('learned-dismiss');
    expect(learned.score).toBeGreaterThan(0.55);
  });
});

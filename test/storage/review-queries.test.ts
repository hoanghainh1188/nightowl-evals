import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openStore, type Store } from '../../src/storage/store.js';
import { seed } from '../helpers/seed-failures.js';
import { createFakeRepo, type TempDir } from '../helpers/temp-repo.js';

describe('review queries', () => {
  let repo: TempDir;
  let store: Store;
  let ids: number[];

  beforeEach(async () => {
    repo = await createFakeRepo();
    ids = await seed(repo.path, [
      { filePath: 'a.ts', prompt: 'first', createdAt: '2026-11-01T00:00:00.000Z' },
      { filePath: 'b.ts', status: 'dismissed', createdAt: '2026-11-02T00:00:00.000Z' },
      {
        filePath: 'c.ts',
        source: 'ai-self-fix',
        prompt: 'isAdult from 18',
        feedback: 'wrong, 18 counts',
        category: 'logic',
        reason: 'boundary',
        confidence: 0.8,
        createdAt: '2026-11-03T00:00:00.000Z',
      },
    ]);
    store = await openStore({ cwd: repo.path });
  });
  afterEach(async () => {
    store.close();
    await repo.cleanup();
  });

  const listed = (filter: Partial<Parameters<Store['listFailuresForReview']>[0]> = {}) =>
    store.listFailuresForReview({ statuses: ['flagged'], source: null, agents: null, limit: 20, ...filter }).map((f) => f.filePath);

  it('lists flagged failures, newest first', () => {
    expect(listed()).toEqual(['c.ts', 'a.ts']);
  });

  it('filters by status and source, and limits', () => {
    expect(listed({ statuses: null })).toEqual(['c.ts', 'b.ts', 'a.ts']);
    expect(listed({ statuses: ['dismissed'] })).toEqual(['b.ts']);
    expect(listed({ statuses: null, source: 'ai-self-fix' })).toEqual(['c.ts']);
    expect(listed({ statuses: null, limit: 1 })).toEqual(['c.ts']);
  });

  it('returns one failure with its prompts and classification', () => {
    expect(store.getFailureForReview(ids[2] as number)).toMatchObject({
      id: ids[2],
      filePath: 'c.ts',
      source: 'ai-self-fix',
      status: 'flagged',
      prompt: 'isAdult from 18',
      feedback: 'wrong, 18 counts',
      category: 'logic',
      categoryReason: 'boundary',
      categoryConfidence: 0.8,
      aiContent: 'ai\n',
      finalContent: 'dev\n',
    });
    expect(store.getFailureForReview(9999)).toBeNull();
  });

  describe('setFailureStatus', () => {
    const status = (id: number) => store.getFailureForReview(id)?.status;

    it('changes every given failure and reports those already in that status', () => {
      const [a, b] = ids as [number, number];
      expect(store.setFailureStatus([a, b, a], 'dismissed')).toEqual({ ok: true, changed: [a], unchanged: [b] });
      expect([status(a), status(b)]).toEqual(['dismissed', 'dismissed']);
    });

    it('changes nothing when an id does not exist', () => {
      const [a] = ids as [number];
      expect(store.setFailureStatus([a, 9999, 9998], 'confirmed')).toEqual({ ok: false, missing: [9998, 9999] });
      expect(status(a)).toBe('flagged');
    });
  });
});

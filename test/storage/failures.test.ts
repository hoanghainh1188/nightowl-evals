import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { NewFailure } from '../../src/storage/failures.js';
import { openStore, type Store } from '../../src/storage/store.js';
import { createFakeRepo, type TempDir } from '../helpers/temp-repo.js';

describe('failure records storage', () => {
  let repo: TempDir;
  let store: Store;

  beforeEach(async () => {
    repo = await createFakeRepo();
    store = await openStore({ cwd: repo.path });
  });
  afterEach(async () => {
    store.close();
    await repo.cleanup();
  });

  const event = (kind: string, sessionId: string | null, filePath: string | null = null) =>
    store.insertEvent({ source: kind === 'commit-check' ? 'git' : 'claude-code', kind, sessionId, filePath, payload: { n: 1 } });

  const failure = (aiEventId: number, overrides: Partial<NewFailure> = {}): NewFailure => ({
    filePath: 'a.ts',
    aiEventId,
    promptEventId: null,
    aiContent: 'ai',
    finalContent: 'dev',
    ...overrides,
  });

  it('lists commit-checks not attached yet, oldest first, without payloads', () => {
    const c1 = event('commit-check', null, 'a.ts');
    event('edit', 's1', 'a.ts');
    const c2 = event('commit-check', null, 'b.ts');
    expect(store.listUnattachedChecks()).toEqual([
      { id: c1.id, filePath: 'a.ts' },
      { id: c2.id, filePath: 'b.ts' },
    ]);
    expect(store.getEventPayload(c1.id)).toEqual({ n: 1 });
    expect(store.getEventPayload(9999)).toBeNull();
  });

  it('stores a failure with its checks in one transaction and never twice', () => {
    const edit = event('edit', 's1', 'a.ts');
    const older = event('commit-check', null, 'a.ts');
    const latest = event('commit-check', null, 'a.ts');
    const attachments = [
      { checkId: older.id, outcome: 'superseded' as const },
      { checkId: latest.id, outcome: 'failure' as const, failure: failure(edit.id) },
    ];
    expect(store.attachChecks('abc123', attachments)).toBe(1);
    expect(store.attachChecks('abc123', attachments)).toBe(0);
    expect(store.listUnattachedChecks()).toEqual([]);
    expect(store.countFailures()).toEqual({ total: 1, byStatus: { flagged: 1 } });
  });

  it('rolls back the failure when attaching fails', () => {
    const edit = event('edit', 's1', 'a.ts');
    const check = event('commit-check', null, 'a.ts');
    expect(() =>
      store.attachChecks('abc', [
        { checkId: check.id, outcome: 'failure', failure: failure(edit.id) },
        // Unknown event id: violates the foreign key.
        { checkId: 9999, outcome: 'not-a-failure' },
      ]),
    ).toThrow();
    expect(store.countFailures().total).toBe(0);
    expect(store.listUnattachedChecks()).toHaveLength(1);
  });

  it('finds the latest prompt of the same session before an edit', () => {
    const p1 = event('prompt', 's1');
    event('prompt', 's2');
    const p3 = event('prompt', 's1');
    const edit = event('edit', 's1', 'a.ts');
    event('prompt', 's1');
    expect(store.findPromptBefore(edit.id)).toBe(p3.id);
    expect(p1.id).toBeLessThan(p3.id);
  });

  it('finds no prompt for another session, a missing session or no prompt', () => {
    event('prompt', 's2');
    expect(store.findPromptBefore(event('edit', 's1', 'a.ts').id)).toBeNull();
    expect(store.findPromptBefore(event('edit', null, 'a.ts').id)).toBeNull();
    expect(store.findPromptBefore(9999)).toBeNull();
  });

  it('counts failures by status', () => {
    expect(store.countFailures()).toEqual({ total: 0, byStatus: {} });
  });
});

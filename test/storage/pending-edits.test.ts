import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openStore, type Store } from '../../src/storage/store.js';
import { createFakeRepo, type TempDir } from '../helpers/temp-repo.js';

describe('pending AI edits', () => {
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

  const edit = (filePath: string, snapshot: string | null) =>
    store.insertEvent({ source: 'claude-code', kind: 'edit', sessionId: 's1', filePath, payload: { snapshot } });

  const check = (filePath: string, editIds: readonly number[]) =>
    store.recordCommitCheck({ source: 'git', kind: 'commit-check', filePath, payload: { ai_event_ids: editIds } }, editIds);

  it('lists unchecked edits for the given files, oldest first, without loading payloads', () => {
    const a1 = edit('a.ts', 'v1');
    const a2 = edit('a.ts', null);
    edit('b.ts', 'x');
    expect(store.listUncheckedEdits(['a.ts'])).toEqual([
      { id: a1.id, filePath: 'a.ts', sessionId: 's1' },
      { id: a2.id, filePath: 'a.ts', sessionId: 's1' },
    ]);
  });

  it('leaves out edits a commit-check already counted', () => {
    const a1 = edit('a.ts', 'v1');
    const a2 = edit('a.ts', 'v2');
    check('a.ts', [a1.id]);
    expect(store.listUncheckedEdits(['a.ts']).map((e) => e.id)).toEqual([a2.id]);
  });

  it('returns nothing for an empty file list', () => {
    edit('a.ts', 'v1');
    expect(store.listUncheckedEdits([])).toEqual([]);
  });

  it('reads one snapshot by id, or null when it was skipped', () => {
    expect(store.getSnapshot(edit('a.ts', 'v1').id)).toBe('v1');
    expect(store.getSnapshot(edit('a.ts', null).id)).toBeNull();
    expect(store.getSnapshot(9999)).toBeNull();
  });

  it('records a commit-check and its counted edits atomically', () => {
    const a1 = edit('a.ts', 'v1');
    const saved = check('a.ts', [a1.id]);
    expect(saved.kind).toBe('commit-check');
    expect(() => check('a.ts', [a1.id])).toThrow();
    expect(store.listEvents({ kinds: ['commit-check'] })).toHaveLength(1);
  });

  it('stays fast after many large historical commit-checks', () => {
    const big = 'x'.repeat(100 * 1024);
    for (let i = 0; i < 300; i += 1) {
      const old = edit(`old/${i}.ts`, 'v');
      store.recordCommitCheck(
        { source: 'git', kind: 'commit-check', filePath: `old/${i}.ts`, payload: { ai_event_ids: [old.id], staged_content: big } },
        [old.id],
      );
    }
    const files = Array.from({ length: 500 }, (_, i) => `src/f${i}.ts`);
    for (const file of files) edit(file, 'snapshot');
    const started = Date.now();
    expect(store.listUncheckedEdits(files)).toHaveLength(500);
    expect(Date.now() - started).toBeLessThan(200);
  }, 60_000);
});

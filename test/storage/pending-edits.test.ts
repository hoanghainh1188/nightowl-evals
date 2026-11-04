import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openStore, type Store } from '../../src/storage/store.js';
import { createFakeRepo, type TempDir } from '../helpers/temp-repo.js';

describe('listUncheckedEdits', () => {
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
    store.insertEvent({ source: 'claude-code', kind: 'edit', filePath, payload: { snapshot } });

  it('returns edits with a snapshot for the given files, oldest first', () => {
    const a1 = edit('a.ts', 'v1');
    edit('a.ts', null);
    const a2 = edit('a.ts', 'v2');
    edit('b.ts', 'x');
    expect(store.listUncheckedEdits(['a.ts']).map((e) => e.id)).toEqual([a1.id, a2.id]);
  });

  it('leaves out edits a commit-check already counted', () => {
    const a1 = edit('a.ts', 'v1');
    const a2 = edit('a.ts', 'v2');
    store.insertEvent({ source: 'git', kind: 'commit-check', filePath: 'a.ts', payload: { ai_event_ids: [a1.id] } });
    expect(store.listUncheckedEdits(['a.ts']).map((e) => e.id)).toEqual([a2.id]);
  });

  it('returns nothing for an empty file list', () => {
    edit('a.ts', 'v1');
    expect(store.listUncheckedEdits([])).toEqual([]);
  });
});

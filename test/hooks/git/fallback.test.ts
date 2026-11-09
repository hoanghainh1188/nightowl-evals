import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkStagedChanges } from '../../../src/hooks/git/check-commit.js';
import { openStore } from '../../../src/storage/store.js';
import { createGitRepo, git } from '../../helpers/git-repo.js';
import { type TempDir, writeFiles } from '../../helpers/temp-repo.js';

describe('git agent fallback', () => {
  let repo: TempDir;
  beforeEach(async () => {
    repo = await createGitRepo();
    (await openStore({ cwd: repo.path })).close();
  });
  afterEach(() => repo.cleanup());

  it('records unattributed-change without creating a failure pair', async () => {
    await writeFiles(repo.path, { 'a.ts': 'hello\n' });
    git(repo.path, ['add', 'a.ts']);
    const written = await checkStagedChanges(repo.path, Date.now() + 5_000);
    expect(written).toBeGreaterThan(0);
    const store = await openStore({ cwd: repo.path, readOnly: true });
    try {
      const events = store.listEvents({ kinds: ['unattributed-change'] });
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        source: 'git',
        kind: 'unattributed-change',
        filePath: 'a.ts',
        payload: expect.objectContaining({ source: 'git-fallback' }),
      });
      expect(store.countFailures().total).toBe(0);
    } finally {
      store.close();
    }
  });
});

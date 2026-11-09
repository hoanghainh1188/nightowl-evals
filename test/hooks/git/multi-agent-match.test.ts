import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkStagedChanges } from '../../../src/hooks/git/check-commit.js';
import { attachCommit } from '../../../src/hooks/git/attach-commit.js';
import { openStore } from '../../../src/storage/store.js';
import { createGitRepo, git } from '../../helpers/git-repo.js';
import { type TempDir, writeFiles } from '../../helpers/temp-repo.js';

describe('multi-agent failure matching', () => {
  let repo: TempDir;
  beforeEach(async () => {
    repo = await createGitRepo();
  });
  afterEach(() => repo.cleanup());

  it('does not attach a Cursor failure to a Claude snapshot', async () => {
    const store = await openStore({ cwd: repo.path });
    try {
      store.insertEvent({
        source: 'agent-hook',
        agent: 'cursor',
        kind: 'edit',
        sessionId: 'c1',
        filePath: 'a.ts',
        payload: { snapshot: 'cursor version\n' },
      });
      store.insertEvent({
        source: 'agent-hook',
        agent: 'claude-code',
        kind: 'edit',
        sessionId: 's1',
        filePath: 'a.ts',
        payload: { snapshot: 'claude version\n' },
      });
    } finally {
      store.close();
    }

    await writeFiles(repo.path, { 'a.ts': 'developer fixed cursor version\n' });
    git(repo.path, ['add', 'a.ts']);
    await checkStagedChanges(repo.path, Date.now() + 5_000);
    git(repo.path, ['commit', '-q', '-m', 'fix']);
    await attachCommit(repo.path, Date.now() + 5_000);

    const db = await openStore({ cwd: repo.path, readOnly: true });
    try {
      const failures = db.listFailuresForReview({ statuses: null, source: null, agents: null, limit: 20 });
      expect(failures.map((f) => f.agent).sort()).toEqual(['claude-code', 'cursor']);
      const cursor = failures.find((f) => f.agent === 'cursor');
      expect(cursor?.aiContent).toBe('cursor version\n');
      const claude = failures.find((f) => f.agent === 'claude-code');
      expect(claude?.aiContent).toBe('claude version\n');
    } finally {
      db.close();
    }
  });
});

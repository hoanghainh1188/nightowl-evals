import { readdir } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFailuresCommand } from '../../src/commands/failures.js';
import { openStore } from '../../src/storage/store.js';
import { createFakeIo } from '../helpers/fake-io.js';
import { createFakeRepo, createTempDir, type TempDir } from '../helpers/temp-repo.js';

describe('nightowl failures', () => {
  let repo: TempDir;
  beforeEach(async () => {
    repo = await createFakeRepo();
  });
  afterEach(() => repo.cleanup());

  async function addFailures(statuses: readonly string[]): Promise<void> {
    const store = await openStore({ cwd: repo.path });
    try {
      const edit = store.insertEvent({ source: 'claude-code', kind: 'edit', filePath: 'a.ts', payload: {} });
      for (const status of statuses) {
        const check = store.insertEvent({ source: 'git', kind: 'commit-check', filePath: 'a.ts', payload: {} });
        store.attachChecks('sha', [
          {
            checkId: check.id,
            outcome: 'failure',
            failure: { filePath: 'a.ts', aiEventId: edit.id, promptEventId: null, aiContent: 'x', finalContent: 'y' },
          },
        ]);
      }
    } finally {
      store.close();
    }
    if (statuses.includes('dismissed')) {
      const { DatabaseSync } = await import('node:sqlite');
      const db = new DatabaseSync(`${repo.path}/.nightowl/nightowl.db`);
      db.exec(`UPDATE failures SET status = 'dismissed' WHERE id = (SELECT MAX(id) FROM failures)`);
      db.close();
    }
  }

  async function run(cwd = repo.path) {
    const fake = createFakeIo();
    const code = await createFailuresCommand({ cwd: () => cwd }).run([], fake.io);
    return { code, out: fake.out(), err: fake.err() };
  }

  it('reports zero failures', async () => {
    expect(await run()).toEqual({ code: 0, out: '0 failures recorded\n', err: '' });
  });

  it('reports the total and the count per status', async () => {
    await addFailures(['flagged', 'flagged', 'flagged']);
    expect((await run()).out).toBe('3 failures recorded\n  flagged: 3\n');
  });

  it('lists every status present', async () => {
    await addFailures(['flagged', 'dismissed']);
    expect((await run()).out).toBe('2 failures recorded\n  dismissed: 1\n  flagged: 1\n');
  });

  it('fails outside a git repository without creating files', async () => {
    const outside = await createTempDir();
    try {
      const result = await run(outside.path);
      expect(result.code).toBe(1);
      expect(result.err).toMatch(/git repository/);
      expect(await readdir(outside.path)).toEqual([]);
    } finally {
      await outside.cleanup();
    }
  });
});

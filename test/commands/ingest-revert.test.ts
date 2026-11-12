import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createIngestRevertCommand } from '../../src/commands/ingest-revert.js';
import { openStore } from '../../src/storage/store.js';
import { createFakeIo } from '../helpers/fake-io.js';
import { createGitRepo, git } from '../helpers/git-repo.js';
import { seed } from '../helpers/seed-failures.js';
import { createFakeRepo, createTempDir, type TempDir } from '../helpers/temp-repo.js';

describe('nightowl ingest-revert', () => {
  let repo: TempDir;
  afterEach(() => repo.cleanup());

  async function run(args: readonly string[] = [], cwd = () => repo.path) {
    const fake = createFakeIo();
    const code = await createIngestRevertCommand({ cwd, now: () => new Date('2026-11-12T00:00:00.000Z') }).run(
      args,
      fake.io,
    );
    return { code, out: fake.out(), err: fake.err() };
  }

  it('errors when NightOwl is not initialized', async () => {
    repo = await createFakeRepo();
    const result = await run();
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/init/i);
  });

  it('errors when there is no git repository', async () => {
    repo = await createTempDir();
    const result = await run();
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/git/i);
  });

  it('help mentions detection limits', async () => {
    repo = await createFakeRepo();
    const help = createIngestRevertCommand().help;
    expect(help).toMatch(/squash/i);
    expect(help).toMatch(/cherry-pick/i);
  });

  it('ingests a matching revert idempotently without creating failures', async () => {
    repo = await createGitRepo();
    await writeFile(join(repo.path, 'a.ts'), 'bad\n', 'utf8');
    git(repo.path, ['add', 'a.ts']);
    git(repo.path, ['commit', '-q', '-m', 'bad change']);
    const badSha = git(repo.path, ['rev-parse', 'HEAD']).trim();

    await seed(repo.path, [{ filePath: 'a.ts', commitSha: badSha, aiContent: 'bad\n', finalContent: 'good\n' }]);

    git(repo.path, ['revert', '--no-edit', 'HEAD']);

    expect(await run()).toMatchObject({ code: 0 });
    expect((await run()).out).toMatch(/0 new.*1 duplicate/i);

    const store = await openStore({ cwd: repo.path, readOnly: true });
    try {
      const events = store.listEvents({ kinds: ['revert'] });
      expect(events).toHaveLength(1);
      expect(store.countFailures().total).toBe(1);
      expect(events[0]).toMatchObject({
        source: 'git',
        kind: 'revert',
        payload: expect.objectContaining({
          reverted_commit_sha: badSha,
          failure_ids: expect.arrayContaining([expect.any(Number)]),
        }),
      });
      expect((events[0]!.payload as { revert_commit_sha: string }).revert_commit_sha).toMatch(/^[0-9a-f]{40}$/);
    } finally {
      store.close();
    }
  });

  it('does not invent events for reverts with no matching failure', async () => {
    repo = await createGitRepo();
    (await openStore({ cwd: repo.path })).close();
    await writeFile(join(repo.path, 'a.ts'), 'x\n', 'utf8');
    git(repo.path, ['add', 'a.ts']);
    git(repo.path, ['commit', '-q', '-m', 'change']);
    git(repo.path, ['revert', '--no-edit', 'HEAD']);

    const result = await run();
    expect(result.code).toBe(0);
    expect(result.out).toMatch(/0 new/);

    const store = await openStore({ cwd: repo.path, readOnly: true });
    try {
      expect(store.listEvents({ kinds: ['revert'] })).toHaveLength(0);
      expect(store.countFailures().total).toBe(0);
    } finally {
      store.close();
    }
  });
});

describe('nightowl ingest-revert outside a fake .git dir', () => {
  it('rejects invalid --since', async () => {
    const repo = await createFakeRepo();
    try {
      await mkdir(join(repo.path, '.nightowl'), { recursive: true });
      const fake = createFakeIo();
      const code = await createIngestRevertCommand({
        cwd: () => repo.path,
        now: () => new Date('2026-11-12T00:00:00.000Z'),
      }).run(['--since', '11/12/2026'], fake.io);
      expect(code).toBe(1);
      expect(fake.err()).toMatch(/since/i);
    } finally {
      await repo.cleanup();
    }
  });
});

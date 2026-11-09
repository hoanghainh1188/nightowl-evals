import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPostcommitCommand } from '../../src/commands/postcommit.js';
import { createPrecommitCommand } from '../../src/commands/precommit.js';
import { openStore } from '../../src/storage/store.js';
import { createFakeIo } from '../helpers/fake-io.js';
import { createGitRepo, git } from '../helpers/git-repo.js';
import { type TempDir, writeFiles } from '../helpers/temp-repo.js';

describe('nightowl postcommit', () => {
  let repo: TempDir;
  beforeEach(async () => {
    repo = await createGitRepo();
  });
  afterEach(() => repo.cleanup());

  async function postcommit(budgetMs?: number) {
    const fake = createFakeIo();
    const command = createPostcommitCommand({ cwd: () => repo.path, ...(budgetMs === undefined ? {} : { budgetMs }) });
    const code = await command.run([], fake.io);
    return { code, out: fake.out(), err: fake.err() };
  }

  async function failureCount(): Promise<number> {
    const store = await openStore({ cwd: repo.path });
    try {
      return store.countFailures().total;
    } finally {
      store.close();
    }
  }

  async function aiWroteThenDevChanged(): Promise<void> {
    await writeFiles(repo.path, { 'a.ts': 'ai\n' });
    const store = await openStore({ cwd: repo.path });
    store.insertEvent({ source: 'agent-hook', kind: 'edit', filePath: 'a.ts', payload: { snapshot: 'ai\n' } });
    store.close();
    await writeFiles(repo.path, { 'a.ts': 'dev\n' });
    git(repo.path, ['add', '-A']);
    await createPrecommitCommand({ cwd: () => repo.path }).run([], createFakeIo().io);
    git(repo.path, ['commit', '-q', '-m', 'x']);
  }

  it('records the failure silently and exits 0', async () => {
    await aiWroteThenDevChanged();
    expect(await postcommit()).toEqual({ code: 0, out: '', err: '' });
    expect(await failureCount()).toBe(1);
  });

  it('does nothing and creates nothing before init', async () => {
    expect(await postcommit()).toEqual({ code: 0, out: '', err: '' });
    expect(await readdir(repo.path)).not.toContain('.nightowl');
  });

  it('logs a corrupt database to nightowl.log and stays silent', async () => {
    await writeFiles(repo.path, { '.nightowl/nightowl.db': 'not a database' });
    expect(await postcommit()).toEqual({ code: 0, out: '', err: '' });
    expect(await readFile(join(repo.path, '.nightowl/nightowl.log'), 'utf8')).toMatch(/ postcommit /);
  });

  it('stops when the time budget is used up and still exits 0', async () => {
    await aiWroteThenDevChanged();
    expect((await postcommit(0)).code).toBe(0);
    expect(await failureCount()).toBe(0);
  });

  it('exits 0 even if the working directory cannot be read', async () => {
    const fake = createFakeIo();
    const command = createPostcommitCommand({
      cwd: () => {
        throw new Error('ENOENT: uv_cwd');
      },
    });
    expect(await command.run([], fake.io)).toBe(0);
    expect(fake.err()).toBe('');
  });
});

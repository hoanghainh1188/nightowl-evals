import { execFileSync, spawnSync } from 'node:child_process';
import { chmod, writeFile } from 'node:fs/promises';
import { delimiter, dirname, join } from 'node:path';
import { afterAll, beforeAll, beforeEach, afterEach, describe, expect, it } from 'vitest';
import { openStore } from '../../src/storage/store.js';
import { hookFixture } from '../helpers/fixtures.js';
import { createGitRepo, git } from '../helpers/git-repo.js';
import { createTempDir, type TempDir, writeFiles } from '../helpers/temp-repo.js';

const BIN = join(import.meta.dirname, '../../dist/bin.js');
const GIT_DIR = dirname(execFileSync('which', ['git'], { encoding: 'utf8' }).trim());
// A PATH with git and a shell but no nightowl.
const BARE_PATH = [GIT_DIR, '/usr/bin', '/bin'].join(delimiter);

describe('Claude Code edit → real git commit', () => {
  let shimDir: TempDir;
  let repo: TempDir;
  let withNightowl: NodeJS.ProcessEnv;

  beforeAll(async () => {
    shimDir = await createTempDir();
    const shim = join(shimDir.path, 'nightowl');
    await writeFile(shim, `#!/bin/sh\nexec "${process.execPath}" "${BIN}" "$@"\n`);
    await chmod(shim, 0o755);
    withNightowl = { ...process.env, PATH: `${shimDir.path}${delimiter}${BARE_PATH}` };
  });
  afterAll(() => shimDir.cleanup());

  beforeEach(async () => {
    repo = await createGitRepo();
  });
  afterEach(() => repo.cleanup());

  function nightowl(args: readonly string[], input = ''): void {
    const result = spawnSync(process.execPath, [BIN, ...args], { cwd: repo.path, env: withNightowl, input, encoding: 'utf8' });
    expect(result.status).toBe(0);
  }

  function commitAll(env: NodeJS.ProcessEnv): number | null {
    git(repo.path, ['add', '-A'], env);
    return spawnSync('git', ['commit', '-q', '-m', 'change'], { cwd: repo.path, env, stdio: 'ignore' }).status;
  }

  async function outcomes(): Promise<unknown[]> {
    const store = await openStore({ cwd: repo.path });
    try {
      return store.listEvents({ kinds: ['commit-check'] }).map((event) => (event.payload as { outcome: string }).outcome);
    } finally {
      store.close();
    }
  }

  it('flags a file the developer changed after the AI wrote it, once', async () => {
    nightowl(['init']);
    await writeFiles(repo.path, { 'src/a.ts': 'export const a = 1;\n' });
    nightowl(['log'], hookFixture('post-tool-use-write', repo.path));
    await writeFiles(repo.path, { 'src/a.ts': 'export const a = 2;\n' });
    expect(commitAll(withNightowl)).toBe(0);
    expect(await outcomes()).toEqual(['modified']);

    await writeFiles(repo.path, { 'src/a.ts': 'export const a = 3;\n' });
    expect(commitAll(withNightowl)).toBe(0);
    expect(await outcomes()).toEqual(['modified']);
  });

  it('records unchanged when the AI version is committed as is', async () => {
    nightowl(['init']);
    await writeFiles(repo.path, { 'src/a.ts': 'export const a = 1;\n' });
    nightowl(['log'], hookFixture('post-tool-use-write', repo.path));
    expect(commitAll(withNightowl)).toBe(0);
    expect(await outcomes()).toEqual(['unchanged']);
  });

  async function failures(): Promise<Array<{ file_path: string; commit_sha: string }>> {
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(join(repo.path, '.nightowl/nightowl.db'));
    try {
      return db.prepare('SELECT file_path, commit_sha FROM failures').all() as unknown as Array<{ file_path: string; commit_sha: string }>;
    } finally {
      db.close();
    }
  }

  it('records one failure for the commit that was actually made', async () => {
    nightowl(['init']);
    await writeFiles(repo.path, { 'src/a.ts': 'export const a = 1;\n' });
    nightowl(['log'], hookFixture('post-tool-use-write', repo.path));
    await writeFiles(repo.path, { 'src/a.ts': 'export const a = 2;\n' });
    expect(commitAll(withNightowl)).toBe(0);
    expect(await failures()).toEqual([{ file_path: 'src/a.ts', commit_sha: git(repo.path, ['rev-parse', 'HEAD']).trim() }]);
  });

  it('records no failure when the commit is aborted after pre-commit', async () => {
    nightowl(['init']);
    await writeFile(join(repo.path, '.git/hooks/commit-msg'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
    await writeFiles(repo.path, { 'src/a.ts': 'export const a = 1;\n' });
    nightowl(['log'], hookFixture('post-tool-use-write', repo.path));
    await writeFiles(repo.path, { 'src/a.ts': 'export const a = 2;\n' });
    expect(commitAll(withNightowl)).not.toBe(0);
    expect(await outcomes()).toEqual(['modified']);
    expect(await failures()).toEqual([]);
  });

  it('records no failure when the AI version is committed as is', async () => {
    nightowl(['init']);
    await writeFiles(repo.path, { 'src/a.ts': 'export const a = 1;\n' });
    nightowl(['log'], hookFixture('post-tool-use-write', repo.path));
    expect(commitAll(withNightowl)).toBe(0);
    expect(await failures()).toEqual([]);
  });

  it('lets the commit through when nightowl is not on PATH', async () => {
    nightowl(['init']);
    await writeFiles(repo.path, { 'src/a.ts': 'x\n' });
    expect(spawnSync('sh', ['-c', 'command -v nightowl'], { env: { PATH: BARE_PATH } }).status).not.toBe(0);
    expect(commitAll({ ...process.env, PATH: BARE_PATH })).toBe(0);
    expect(git(repo.path, ['log', '--oneline']).trim().split('\n')).toHaveLength(2);
  });
});

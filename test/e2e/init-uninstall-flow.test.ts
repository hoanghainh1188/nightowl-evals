import { spawnSync } from 'node:child_process';
import { chmod, readdir, readFile, writeFile } from 'node:fs/promises';
import { delimiter, dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openStore } from '../../src/storage/store.js';
import { hookFixture } from '../helpers/fixtures.js';
import { createGitRepo, git } from '../helpers/git-repo.js';
import { createTempDir, type TempDir } from '../helpers/temp-repo.js';

const BIN = join(import.meta.dirname, '../../dist/bin.js');
const GIT_DIR = dirname(spawnSync('/bin/sh', ['-c', 'command -v git'], { encoding: 'utf8' }).stdout.trim());

describe('init, the personal hook and uninstall (built bin)', () => {
  let repo: TempDir;
  let shims: TempDir;
  let env: NodeJS.ProcessEnv;

  beforeEach(async () => {
    repo = await createGitRepo();
    shims = await createTempDir();
    await writeFile(join(shims.path, 'nightowl'), `#!/bin/sh\nexec "${process.execPath}" "${BIN}" "$@"\n`);
    await chmod(join(shims.path, 'nightowl'), 0o755);
    env = { ...process.env, PATH: [shims.path, GIT_DIR, '/usr/bin', '/bin'].join(delimiter) };
  });

  afterEach(async () => {
    await repo.cleanup();
    await shims.cleanup();
  });

  const nightowl = (args: readonly string[]) =>
    spawnSync(process.execPath, [BIN, ...args], { cwd: repo.path, env, encoding: 'utf8' });

  // Runs a hook command the way Claude Code does: through a shell, with the event on stdin.
  async function runClaudeHook(event: string, input: string, path = env.PATH) {
    const settings = JSON.parse(await readFile(join(repo.path, '.claude/settings.local.json'), 'utf8'));
    const command = settings.hooks[event][0].hooks[0].command as string;
    return spawnSync('/bin/sh', ['-c', command], { cwd: repo.path, env: { ...env, PATH: path }, input, encoding: 'utf8' });
  }

  it('records through the personal hook, stays out of git, and uninstalls cleanly', async () => {
    expect(nightowl(['init', '--agents', 'claude-code']).status).toBe(0);
    expect(git(repo.path, ['status', '--porcelain', '--untracked-files=all'])).toBe('?? .gitignore\n');

    const hook = await runClaudeHook('UserPromptSubmit', hookFixture('user-prompt-submit', repo.path));
    expect([hook.status, hook.stdout, hook.stderr]).toEqual([0, '', '']);
    const store = await openStore({ cwd: repo.path, readOnly: true });
    try {
      expect(store.listEvents().map((event) => event.kind)).toEqual(['prompt']);
    } finally {
      store.close();
    }

    const missing = await runClaudeHook('UserPromptSubmit', hookFixture('user-prompt-submit', repo.path), '/usr/bin:/bin');
    expect([missing.status, missing.stdout, missing.stderr]).toEqual([0, '', '']);

    const removed = nightowl(['uninstall']);
    expect(removed.status).toBe(0);
    expect(removed.stdout).toContain('removed .claude/settings.local.json');
    expect(await readdir(join(repo.path, '.claude'))).toEqual([]);
    expect(await readdir(join(repo.path, '.nightowl'))).toContain('nightowl.db');
  });
});

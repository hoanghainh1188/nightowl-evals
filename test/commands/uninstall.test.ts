import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInitCommand } from '../../src/commands/init.js';
import { createUninstallCommand } from '../../src/commands/uninstall.js';
import { installGitHook } from '../../src/setup/git-hook.js';
import { createFakeIo } from '../helpers/fake-io.js';
import { createGitRepo, git } from '../helpers/git-repo.js';
import { createTempDir, type TempDir } from '../helpers/temp-repo.js';

const PERSONAL = '.claude/settings.local.json';
const SHARED = '.claude/settings.json';

describe('nightowl uninstall', () => {
  let repo: TempDir;
  beforeEach(async () => {
    repo = await createGitRepo();
  });
  afterEach(() => repo.cleanup());

  async function init(args: readonly string[] = []): Promise<void> {
    await createInitCommand({ cwd: () => repo.path, isOnPath: () => true, installGitHook }).run(args, createFakeIo().io);
  }

  async function uninstall(args: readonly string[] = [], cwd = repo.path) {
    const fake = createFakeIo();
    const code = await createUninstallCommand({ cwd: () => cwd }).run(args, fake.io);
    return { code, out: fake.out(), err: fake.err() };
  }

  const hooksDir = () => join(repo.path, '.git/hooks');
  const userHooks = async () => (await readdir(hooksDir())).filter((name) => !name.endsWith('.sample'));

  it.each([[[]], [['--shared']]])('removes everything init %j added, but keeps the data', async (args) => {
    await init(args);
    const gitignore = await readFile(join(repo.path, '.gitignore'), 'utf8');
    const result = await uninstall();
    expect(result.code).toBe(0);
    expect(result.err).toBe('');
    expect(await readdir(join(repo.path, '.claude'))).toEqual([]);
    expect(await userHooks()).toEqual([]);
    expect(await readdir(join(repo.path, '.nightowl'))).toContain('nightowl.db');
    expect(await readFile(join(repo.path, '.gitignore'), 'utf8')).toBe(gitignore);
    expect(result.out).toContain(`removed ${args.length === 0 ? PERSONAL : SHARED}`);
    expect(result.out).toContain('removed .git/hooks/pre-commit');
    expect(result.out).toContain('removed .git/hooks/post-commit');
    expect(result.out).toContain('Your data is kept in .nightowl/');
  });

  it("keeps the user's own settings and hook lines", async () => {
    await mkdir(join(repo.path, '.claude'));
    const own = {
      permissions: { allow: ['Bash(npm test)'] },
      hooks: { PostToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo hi' }] }] },
    };
    await writeFile(join(repo.path, SHARED), JSON.stringify(own));
    await writeFile(join(hooksDir(), 'pre-commit'), '#!/bin/sh\nnpm run lint\n', { mode: 0o755 });
    await init(['--shared']);
    const result = await uninstall();
    expect(result.code).toBe(0);
    expect(JSON.parse(await readFile(join(repo.path, SHARED), 'utf8'))).toEqual(own);
    expect(await readFile(join(hooksDir(), 'pre-commit'), 'utf8')).toBe('#!/bin/sh\nnpm run lint\n');
    expect(result.out).toContain(`updated ${SHARED} (removed 2 NightOwl hooks)`);
    expect(result.out).toContain('updated .git/hooks/pre-commit (removed the nightowl line)');
  });

  it('says there is nothing to remove in a repository without NightOwl', async () => {
    const result = await uninstall();
    expect(result).toEqual({ code: 0, out: `Nothing to remove: NightOwl is not set up in ${repo.path}\n`, err: '' });
    expect((await readdir(repo.path)).filter((name) => name !== '.git')).toEqual([]);
  });

  it('leaves hooks managed through core.hooksPath to the user', async () => {
    await init();
    git(repo.path, ['config', 'core.hooksPath', '.husky']);
    await mkdir(join(repo.path, '.husky'));
    await writeFile(join(repo.path, '.husky/pre-commit'), 'nightowl precommit\n');
    const result = await uninstall();
    expect(result.code).toBe(0);
    expect(await readFile(join(repo.path, '.husky/pre-commit'), 'utf8')).toBe('nightowl precommit\n');
    expect(result.err).toContain('git pre-commit hook not changed (core.hooksPath is set to .husky)');
    expect(result.err).toContain('nightowl precommit');
  });

  it('says nothing about hooks under core.hooksPath when NightOwl is not in them', async () => {
    git(repo.path, ['config', 'core.hooksPath', '.husky']);
    await mkdir(join(repo.path, '.husky'));
    await writeFile(join(repo.path, '.husky/pre-commit'), 'npm test\n');
    const result = await uninstall();
    expect(result).toEqual({ code: 0, out: `Nothing to remove: NightOwl is not set up in ${repo.path}\n`, err: '' });
  });

  it('refuses to delete a settings file that is a symlink', async () => {
    await init(['--shared']);
    const shared = join(repo.path, SHARED);
    await writeFile(join(repo.path, 'kept.json'), await readFile(shared, 'utf8'));
    const { rm, symlink } = await import('node:fs/promises');
    await rm(shared);
    await symlink(join(repo.path, 'kept.json'), shared);
    const result = await uninstall();
    expect(result.code).toBe(1);
    expect(result.err).toContain('symlink');
    expect(await userHooks()).toEqual(['post-commit', 'pre-commit']);
    expect(await readFile(join(repo.path, 'kept.json'), 'utf8')).toContain('nightowl log');
  });

  it('reports a git hook it cannot change instead of crashing', async () => {
    await init();
    const { chmod } = await import('node:fs/promises');
    await chmod(hooksDir(), 0o500);
    try {
      const result = await uninstall();
      expect(result.code).toBe(1);
      expect(result.err).toMatch(/^nightowl uninstall: /m);
    } finally {
      await chmod(hooksDir(), 0o755);
    }
  });

  it('changes nothing when a settings file is invalid', async () => {
    await init();
    await writeFile(join(repo.path, SHARED), '{ broken');
    const before = await readFile(join(repo.path, PERSONAL), 'utf8');
    const result = await uninstall();
    expect(result.code).toBe(1);
    expect(result.err).toContain(SHARED);
    expect(await readFile(join(repo.path, PERSONAL), 'utf8')).toBe(before);
    expect(await userHooks()).toEqual(['post-commit', 'pre-commit']);
  });

  it('rejects arguments without changing anything', async () => {
    await init();
    const result = await uninstall(['--all']);
    expect(result.code).toBe(1);
    expect(result.err).toContain('--all');
    expect(await readdir(join(repo.path, '.claude'))).toEqual(['settings.local.json']);
  });

  it('fails outside a git repository', async () => {
    const outside = await createTempDir();
    try {
      const result = await uninstall([], outside.path);
      expect(result.code).toBe(1);
      expect(result.err).toMatch(/git repository/);
    } finally {
      await outside.cleanup();
    }
  });
});

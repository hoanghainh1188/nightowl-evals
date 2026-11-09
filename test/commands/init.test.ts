import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInitCommand } from '../../src/commands/init.js';
import { createFakeIo } from '../helpers/fake-io.js';
import { createGitRepo, git } from '../helpers/git-repo.js';
import { createTempDir, type TempDir } from '../helpers/temp-repo.js';

import { hookLine, installGitHook } from '../../src/setup/git-hook.js';

const ON_PATH = { isOnPath: () => true, installGitHook };
const PERSONAL = '.claude/settings.local.json';
const SHARED = '.claude/settings.json';

async function snapshot(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const file of ['.gitignore', PERSONAL]) {
    result[file] = await readFile(join(root, file), 'utf8');
  }
  return result;
}

describe('nightowl init', () => {
  let repo: TempDir;
  beforeEach(async () => {
    repo = await createGitRepo();
  });
  afterEach(() => repo.cleanup());

  it('sets up .gitignore, personal Claude Code hooks and the database, then reports it', async () => {
    const fake = createFakeIo();
    const code = await createInitCommand({ cwd: () => repo.path, ...ON_PATH }).run([], fake.io);
    expect(code).toBe(0);
    expect(await readFile(join(repo.path, '.gitignore'), 'utf8')).toBe(`${PERSONAL}\n.nightowl/\n`);
    const settings = JSON.parse(await readFile(join(repo.path, PERSONAL), 'utf8'));
    expect(Object.keys(settings.hooks)).toEqual(['PostToolUse', 'UserPromptSubmit']);
    expect(await readdir(join(repo.path, '.claude'))).toEqual(['settings.local.json']);
    expect(await readdir(join(repo.path, '.nightowl'))).toContain('nightowl.db');
    expect(fake.out()).toContain(`created .gitignore (added ${PERSONAL}, .nightowl/)`);
    expect(fake.out()).toContain(`created ${PERSONAL} (hooks: PostToolUse, UserPromptSubmit)`);
    expect(fake.out()).toContain('.git/hooks/pre-commit');
    expect(await readFile(join(repo.path, '.git/hooks/pre-commit'), 'utf8')).toContain('nightowl precommit');
    expect(fake.out()).toContain('.git/hooks/post-commit');
    expect(await readFile(join(repo.path, '.git/hooks/post-commit'), 'utf8')).toContain('nightowl postcommit');
    expect(fake.err()).toBe('');
  });

  it.each([[['--force']], [['now']]])('rejects %j and changes nothing', async (args) => {
    const fake = createFakeIo();
    expect(await createInitCommand({ cwd: () => repo.path, ...ON_PATH }).run(args, fake.io)).toBe(1);
    expect(fake.out()).toBe('');
    expect(fake.err()).toMatch(/^nightowl init: .*/);
    expect(fake.err()).toContain(args[0] as string);
    expect(fake.err()).toContain("Run 'nightowl init --help'");
    expect((await readdir(repo.path)).filter((name) => name !== '.git')).toEqual([]);
    expect((await readdir(join(repo.path, '.git/hooks'))).filter((name) => !name.endsWith('.sample'))).toEqual([]);
  });

  it('explains how to add the hook when core.hooksPath is set, and still succeeds', async () => {
    git(repo.path, ['config', 'core.hooksPath', '.husky']);
    const fake = createFakeIo();
    expect(await createInitCommand({ cwd: () => repo.path, ...ON_PATH }).run([], fake.io)).toBe(0);
    expect(fake.err()).toContain('core.hooksPath');
    expect(fake.err()).toContain('nightowl precommit');
    expect(fake.err()).toContain('post-commit');
    expect(fake.err()).toContain('nightowl postcommit');
    expect((await readdir(repo.path)).includes('.husky')).toBe(false);
  });

  it('reports a git failure as a manual step instead of failing', async () => {
    const fake = createFakeIo();
    const init = createInitCommand({
      cwd: () => repo.path,
      ...ON_PATH,
      installGitHook: async () => {
        throw new Error('git not found');
      },
    });
    expect(await init.run([], fake.io)).toBe(0);
    expect(fake.err()).toContain('git not found');
  });

  it('writes at the repository root when run from a subdirectory', async () => {
    const nested = join(repo.path, 'src');
    await mkdir(nested);
    await createInitCommand({ cwd: () => nested, ...ON_PATH }).run([], createFakeIo().io);
    expect(await readdir(nested)).toEqual([]);
    expect(await readFile(join(repo.path, '.gitignore'), 'utf8')).toContain('.nightowl/\n');
  });

  it('gives the same result when run twice and says it is already set up', async () => {
    const init = createInitCommand({ cwd: () => repo.path, ...ON_PATH });
    await init.run([], createFakeIo().io);
    const first = await snapshot(repo.path);
    const fake = createFakeIo();
    expect(await init.run([], fake.io)).toBe(0);
    expect(await snapshot(repo.path)).toEqual(first);
    expect(fake.out()).toMatch(/already/i);
  });

  it('only adds the post-commit hook to a repository set up in week 1', async () => {
    const preCommit = join(repo.path, '.git/hooks/pre-commit');
    await writeFile(preCommit, `#!/bin/sh\n${hookLine('precommit')}\n`, { mode: 0o755 });
    const before = await readFile(preCommit, 'utf8');
    const fake = createFakeIo();
    expect(await createInitCommand({ cwd: () => repo.path, ...ON_PATH }).run([], fake.io)).toBe(0);
    expect(await readFile(preCommit, 'utf8')).toBe(before);
    expect(fake.out()).not.toContain('pre-commit');
    expect(fake.out()).toContain('created .git/hooks/post-commit (runs nightowl postcommit)');
  });

  it('reports each hook on its own when only one needs a manual step', async () => {
    const { symlink } = await import('node:fs/promises');
    await writeFile(join(repo.path, 'shared.sh'), '#!/bin/sh\n');
    await symlink(join(repo.path, 'shared.sh'), join(repo.path, '.git/hooks/post-commit'));
    const fake = createFakeIo();
    expect(await createInitCommand({ cwd: () => repo.path, ...ON_PATH }).run([], fake.io)).toBe(0);
    expect(fake.out()).toContain('.git/hooks/pre-commit');
    expect(fake.err()).toContain('post-commit hook not installed (post-commit hook is a symlink)');
    expect(fake.err()).not.toContain('pre-commit hook not installed');
  });

  it('fails outside a git repository without creating files', async () => {
    const outside = await createTempDir();
    try {
      const fake = createFakeIo();
      const code = await createInitCommand({ cwd: () => outside.path, ...ON_PATH }).run([], fake.io);
      expect(code).toBe(1);
      expect(fake.err()).toMatch(/git repository/i);
      expect(await readdir(outside.path)).toEqual([]);
    } finally {
      await outside.cleanup();
    }
  });

  it.each([
    [PERSONAL, []],
    [SHARED, ['--shared']],
  ])('changes nothing when %s is invalid', async (file, args) => {
    await mkdir(join(repo.path, '.claude'));
    await writeFile(join(repo.path, file), '{ broken');
    const fake = createFakeIo();
    const code = await createInitCommand({ cwd: () => repo.path, ...ON_PATH }).run(args, fake.io);
    expect(code).toBe(1);
    expect(fake.err()).toContain(file);
    expect((await readdir(repo.path)).sort()).toEqual(['.claude', '.git']);
    expect(await readdir(join(repo.path, '.git/hooks'))).not.toContain('pre-commit');
    expect(await readdir(join(repo.path, '.git/hooks'))).not.toContain('post-commit');
  });

  it('writes the shared settings with --shared and leaves .gitignore to .nightowl/', async () => {
    const fake = createFakeIo();
    expect(await createInitCommand({ cwd: () => repo.path, ...ON_PATH }).run(['--shared'], fake.io)).toBe(0);
    expect(await readdir(join(repo.path, '.claude'))).toEqual(['settings.json']);
    expect(await readFile(join(repo.path, '.gitignore'), 'utf8')).toBe('.nightowl/\n');
    expect(fake.out()).toContain(`created ${SHARED} (hooks: PostToolUse, UserPromptSubmit)`);
  });

  it('leaves hooks set up by an older init in the shared file and says how to move them', async () => {
    await mkdir(join(repo.path, '.claude'));
    const legacy = { hooks: { UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'nightowl log' }] }] } };
    await writeFile(join(repo.path, SHARED), JSON.stringify(legacy));
    const fake = createFakeIo();
    expect(await createInitCommand({ cwd: () => repo.path, ...ON_PATH }).run([], fake.io)).toBe(0);
    expect(await readdir(join(repo.path, '.claude'))).toEqual(['settings.json']);
    expect(fake.out()).toContain(`updated ${SHARED} (upgraded 1 hook)`);
    expect(fake.out()).toContain(`Claude Code hooks stay in ${SHARED}. To make them personal: nightowl uninstall && nightowl init`);
    expect(await readFile(join(repo.path, SHARED), 'utf8')).toContain('command -v nightowl');
  });

  it('warns when both settings files hold NightOwl hooks', async () => {
    const init = createInitCommand({ cwd: () => repo.path, ...ON_PATH });
    await init.run(['--shared'], createFakeIo().io);
    const shared = await readFile(join(repo.path, SHARED), 'utf8');
    await writeFile(join(repo.path, PERSONAL), shared);
    const fake = createFakeIo();
    expect(await init.run([], fake.io)).toBe(0);
    expect(fake.err()).toContain(`NightOwl hooks are in both ${PERSONAL} and ${SHARED}`);
  });

  it('refuses a committed personal settings file', async () => {
    await mkdir(join(repo.path, '.claude'));
    await writeFile(join(repo.path, PERSONAL), '{}\n');
    git(repo.path, ['add', PERSONAL]);
    git(repo.path, ['commit', '-q', '-m', 'settings']);
    const fake = createFakeIo();
    expect(await createInitCommand({ cwd: () => repo.path, ...ON_PATH }).run([], fake.io)).toBe(1);
    expect(fake.err()).toContain('nightowl init --shared');
    expect(await readFile(join(repo.path, PERSONAL), 'utf8')).toBe('{}\n');
    expect(await readdir(repo.path)).not.toContain('.nightowl');
  });

  it('writes no settings when the data folder cannot be created', async () => {
    await writeFile(join(repo.path, '.nightowl'), 'not a folder');
    const fake = createFakeIo();
    expect(await createInitCommand({ cwd: () => repo.path, ...ON_PATH }).run([], fake.io)).toBe(1);
    expect((await readdir(repo.path)).sort()).toEqual(['.git', '.nightowl']);
  });

  it('warns when nightowl is not on PATH but still succeeds', async () => {
    const fake = createFakeIo();
    const code = await createInitCommand({ cwd: () => repo.path, isOnPath: () => false, installGitHook }).run([], fake.io);
    expect(code).toBe(0);
    expect(fake.err()).toContain('npm i -g @hoanghainh/nightowl-evals');
  });

  it('prints specialized Husky instructions when Husky is detected', async () => {
    git(repo.path, ['config', 'core.hooksPath', '.husky']);
    const fake = createFakeIo();
    expect(await createInitCommand({ cwd: () => repo.path, ...ON_PATH }).run([], fake.io)).toBe(0);
    expect(fake.err()).toContain('Husky detected (.husky/)');
    expect(fake.err()).toContain('.husky/pre-commit');
  });

  it('prints specialized Lefthook snippet when Lefthook config exists', async () => {
    await writeFile(join(repo.path, 'lefthook.yml'), 'pre-commit:\n');
    const fake = createFakeIo();
    const code = await createInitCommand({
      cwd: () => repo.path,
      ...ON_PATH,
      installGitHook: async () => ({ status: 'manual', reason: 'managed by lefthook' }),
    }).run([], fake.io);
    expect(code).toBe(0);
    expect(fake.err()).toContain('Lefthook detected (lefthook.yml)');
    expect(fake.err()).toContain('nightowl precommit');
  });
});

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInitCommand } from '../../src/commands/init.js';
import { createFakeIo } from '../helpers/fake-io.js';
import { createGitRepo, git } from '../helpers/git-repo.js';
import { createTempDir, type TempDir } from '../helpers/temp-repo.js';

import { installPreCommit } from '../../src/setup/git-hook.js';

const ON_PATH = { isOnPath: () => true, installPreCommit };

async function snapshot(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const file of ['.gitignore', '.claude/settings.json']) {
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

  it('sets up .gitignore, Claude Code hooks and the database, then reports it', async () => {
    const fake = createFakeIo();
    const code = await createInitCommand({ cwd: () => repo.path, ...ON_PATH }).run([], fake.io);
    expect(code).toBe(0);
    expect(await readFile(join(repo.path, '.gitignore'), 'utf8')).toBe('.nightowl/\n');
    const settings = JSON.parse(await readFile(join(repo.path, '.claude/settings.json'), 'utf8'));
    expect(Object.keys(settings.hooks)).toEqual(['PostToolUse', 'UserPromptSubmit']);
    expect(await readdir(join(repo.path, '.nightowl'))).toContain('nightowl.db');
    expect(fake.out()).toContain('.gitignore');
    expect(fake.out()).toContain('.claude/settings.json');
    expect(fake.out()).toContain('.git/hooks/pre-commit');
    expect(await readFile(join(repo.path, '.git/hooks/pre-commit'), 'utf8')).toContain('nightowl precommit');
    expect(fake.err()).toBe('');
  });

  it('explains how to add the hook when core.hooksPath is set, and still succeeds', async () => {
    git(repo.path, ['config', 'core.hooksPath', '.husky']);
    const fake = createFakeIo();
    expect(await createInitCommand({ cwd: () => repo.path, ...ON_PATH }).run([], fake.io)).toBe(0);
    expect(fake.err()).toContain('core.hooksPath');
    expect(fake.err()).toContain('nightowl precommit');
    expect((await readdir(repo.path)).includes('.husky')).toBe(false);
  });

  it('reports a git failure as a manual step instead of failing', async () => {
    const fake = createFakeIo();
    const init = createInitCommand({
      cwd: () => repo.path,
      ...ON_PATH,
      installPreCommit: async () => {
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
    expect(await readFile(join(repo.path, '.gitignore'), 'utf8')).toBe('.nightowl/\n');
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

  it('changes nothing when .claude/settings.json is invalid', async () => {
    await mkdir(join(repo.path, '.claude'));
    await writeFile(join(repo.path, '.claude/settings.json'), '{ broken');
    const fake = createFakeIo();
    const code = await createInitCommand({ cwd: () => repo.path, ...ON_PATH }).run([], fake.io);
    expect(code).toBe(1);
    expect(fake.err()).toContain('settings.json');
    expect((await readdir(repo.path)).sort()).toEqual(['.claude', '.git']);
    expect(await readdir(join(repo.path, '.git/hooks'))).not.toContain('pre-commit');
  });

  it('warns when nightowl is not on PATH but still succeeds', async () => {
    const fake = createFakeIo();
    const code = await createInitCommand({ cwd: () => repo.path, isOnPath: () => false, installPreCommit }).run([], fake.io);
    expect(code).toBe(0);
    expect(fake.err()).toContain('npm i -g @hoanghainh/nightowl-evals');
  });
});

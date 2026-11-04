import { chmod, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addHookLine, GIT_HOOKS, HOOK_LINE, hookLine, installGitHook } from '../../src/setup/git-hook.js';
import { createGitRepo, git } from '../helpers/git-repo.js';
import type { TempDir } from '../helpers/temp-repo.js';

describe('addHookLine', () => {
  it('creates a sh hook when there is none', () => {
    expect(addHookLine(null)).toEqual({ status: 'created', content: `#!/bin/sh\n${HOOK_LINE}\n` });
  });

  it.each(['#!/bin/sh', '#!/bin/bash', '#!/usr/bin/env bash', '#!/bin/zsh', '#!/usr/bin/env sh -e'])(
    'inserts after a %s shebang and keeps the rest',
    (shebang) => {
      const existing = `${shebang}\nnpm run lint\n`;
      expect(addHookLine(existing)).toEqual({ status: 'updated', content: `${shebang}\n${HOOK_LINE}\nnpm run lint\n` });
    },
  );

  it('adds a sh shebang to a hook without one', () => {
    expect(addHookLine('npm run lint\n')).toEqual({ status: 'updated', content: `#!/bin/sh\n${HOOK_LINE}\nnpm run lint\n` });
  });

  it('leaves non-shell hooks to the user', () => {
    expect(addHookLine('#!/usr/bin/env node\nconsole.log(1)\n')).toEqual({ status: 'manual', reason: 'non-shell hook' });
  });

  it('only recognises the marker at the end of a line it added', () => {
    expect(addHookLine('#!/bin/sh\n# nightowl-evals is set up in CI only\nnpm test\n').status).toBe('updated');
  });

  it('does nothing when the line is already there', () => {
    const once = addHookLine(null);
    expect(once.status === 'created' && addHookLine(once.content)).toEqual({ status: 'unchanged' });
  });

  it('uses the given line', () => {
    expect(addHookLine(null, hookLine('postcommit'))).toEqual({
      status: 'created',
      content: `#!/bin/sh\n${hookLine('postcommit')}\n`,
    });
  });

  it('never lets the NightOwl line fail the hook', () => {
    expect(HOOK_LINE).toMatch(/\|\| true\b/);
    expect(HOOK_LINE).toContain('command -v nightowl');
  });
});

describe.each(GIT_HOOKS)('installGitHook($name)', (hook) => {
  let repo: TempDir;
  const hookFile = () => join(repo.path, '.git', 'hooks', hook.name);

  beforeEach(async () => {
    repo = await createGitRepo();
  });
  afterEach(() => repo.cleanup());

  it('creates an executable hook', async () => {
    expect(await installGitHook(repo.path, hook)).toEqual({ status: 'created', path: hookFile() });
    expect((await stat(hookFile())).mode & 0o777).toBe(0o755);
    expect(await readFile(hookFile(), 'utf8')).toContain(`nightowl ${hook.command}`);
  });

  it('keeps an existing hook and its permissions', async () => {
    await writeFile(hookFile(), '#!/bin/sh\nnpm run lint\n');
    await chmod(hookFile(), 0o750);
    expect((await installGitHook(repo.path, hook)).status).toBe('updated');
    const text = await readFile(hookFile(), 'utf8');
    expect(text).toContain('npm run lint');
    expect(text).toContain(`nightowl ${hook.command}`);
    expect((await stat(hookFile())).mode & 0o777).toBe(0o750);
  });

  it('is idempotent', async () => {
    await installGitHook(repo.path, hook);
    const first = await readFile(hookFile(), 'utf8');
    expect((await installGitHook(repo.path, hook)).status).toBe('unchanged');
    expect(await readFile(hookFile(), 'utf8')).toBe(first);
  });

  it('does not touch hooks managed through core.hooksPath', async () => {
    git(repo.path, ['config', 'core.hooksPath', '.husky']);
    expect(await installGitHook(repo.path, hook)).toEqual({ status: 'manual', reason: 'core.hooksPath is set to .husky' });
    await expect(stat(join(repo.path, '.husky'))).rejects.toThrow();
  });

  it('does not write through a symlinked hook', async () => {
    const { symlink } = await import('node:fs/promises');
    await writeFile(join(repo.path, 'shared-hook.sh'), '#!/bin/sh\necho shared\n');
    await symlink(join(repo.path, 'shared-hook.sh'), hookFile());
    expect(await installGitHook(repo.path, hook)).toEqual({ status: 'manual', reason: `${hook.name} hook is a symlink` });
    expect(await readFile(join(repo.path, 'shared-hook.sh'), 'utf8')).toBe('#!/bin/sh\necho shared\n');
  });

  it('does not touch a hook written in another language', async () => {
    await writeFile(hookFile(), '#!/usr/bin/env node\n');
    expect(await installGitHook(repo.path, hook)).toEqual({ status: 'manual', reason: 'non-shell hook' });
    expect(await readFile(hookFile(), 'utf8')).toBe('#!/usr/bin/env node\n');
  });

  it('leaves the other NightOwl hook alone', async () => {
    await installGitHook(repo.path, hook);
    const other = GIT_HOOKS.find((h) => h.name !== hook.name);
    if (other === undefined) throw new Error('expected two hooks');
    expect((await installGitHook(repo.path, other)).status).toBe('created');
    expect((await installGitHook(repo.path, hook)).status).toBe('unchanged');
  });
});

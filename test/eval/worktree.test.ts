import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  cleanStaleWorktrees,
  isCommitSha,
  openCaseWorktree,
  resolveParentCommit,
  WORKTREES_DIR,
} from '../../src/eval/worktree.js';
import { createGitRepo, git } from '../helpers/git-repo.js';
import type { TempDir } from '../helpers/temp-repo.js';

function commitFile(root: string, message: string): string {
  git(root, ['add', 'a.txt']);
  git(root, ['commit', '-q', '-m', message]);
  return git(root, ['rev-parse', 'HEAD']).trim();
}

describe('eval worktree', () => {
  let repo: TempDir;
  let rootSha: string;
  let first: string;
  let second: string;

  beforeEach(async () => {
    repo = await createGitRepo();
    rootSha = git(repo.path, ['rev-parse', 'HEAD']).trim();
    await writeFile(join(repo.path, 'a.txt'), 'v1\n');
    first = commitFile(repo.path, 'v1');
    await writeFile(join(repo.path, 'a.txt'), 'v2\n');
    second = commitFile(repo.path, 'v2');
  });
  afterEach(() => repo.cleanup());

  const listed = () => git(repo.path, ['worktree', 'list', '--porcelain']);

  describe('isCommitSha', () => {
    it.each([
      ['abcdef1', true],
      ['ABCDEF1234', true],
      ['a'.repeat(64), true],
      ['abc12', false],
      ['a'.repeat(65), false],
      ['HEAD', false],
      ['abcdef1^', false],
      ['-abcdef1', false],
    ])('%s → %s', (value, expected) => {
      expect(isCommitSha(value)).toBe(expected);
    });
  });

  describe('resolveParentCommit', () => {
    it('gives the full sha of the parent commit', async () => {
      expect(await resolveParentCommit(repo.path, second)).toBe(first);
      expect(await resolveParentCommit(repo.path, second.slice(0, 12))).toBe(first);
    });

    it('is null for a root commit, an unknown commit, a bad value, or none', async () => {
      expect(await resolveParentCommit(repo.path, rootSha)).toBeNull();
      expect(await resolveParentCommit(repo.path, 'deadbeefdeadbeef')).toBeNull();
      expect(await resolveParentCommit(repo.path, 'HEAD')).toBeNull();
      expect(await resolveParentCommit(repo.path, null)).toBeNull();
    });
  });

  describe('openCaseWorktree', () => {
    it('checks out the base commit under .nightowl/worktrees without touching the working tree', async () => {
      await writeFile(join(repo.path, 'a.txt'), 'uncommitted\n');
      const worktree = await openCaseWorktree(repo.path, first);
      try {
        expect(worktree.dir.startsWith(join(repo.path, '.nightowl', WORKTREES_DIR))).toBe(true);
        expect(await readFile(join(worktree.dir, 'a.txt'), 'utf8')).toBe('v1\n');
        expect(git(worktree.dir, ['rev-parse', 'HEAD']).trim()).toBe(first);
        expect(listed()).toContain(worktree.dir);
      } finally {
        await worktree.dispose();
      }
      expect(existsSync(worktree.dir)).toBe(false);
      expect(listed()).not.toContain(worktree.dir);
      expect(await readFile(join(repo.path, 'a.txt'), 'utf8')).toBe('uncommitted\n');
      expect(git(repo.path, ['rev-parse', 'HEAD']).trim()).toBe(second);
    });

    it('gives each case its own folder', async () => {
      const a = await openCaseWorktree(repo.path, first);
      const b = await openCaseWorktree(repo.path, first);
      try {
        expect(a.dir).not.toBe(b.dir);
      } finally {
        await a.dispose();
        await b.dispose();
      }
    });

    it('can be disposed twice', async () => {
      const worktree = await openCaseWorktree(repo.path, first);
      await worktree.dispose();
      await expect(worktree.dispose()).resolves.toBeUndefined();
    });

    it('rejects when git cannot create the worktree', async () => {
      await expect(openCaseWorktree(repo.path, 'f'.repeat(40))).rejects.toThrow(/worktree/);
      expect(listed()).not.toContain(WORKTREES_DIR);
    });
  });

  describe('cleanStaleWorktrees', () => {
    it('removes worktrees left behind by an interrupted run', async () => {
      const left = await openCaseWorktree(repo.path, first);
      const stray = join(repo.path, '.nightowl', WORKTREES_DIR, 'stray');
      await mkdir(stray);
      await cleanStaleWorktrees(repo.path);
      expect(existsSync(left.dir)).toBe(false);
      expect(existsSync(stray)).toBe(false);
      expect(listed()).not.toContain(left.dir);
    });

    it('works when no worktree folder exists yet', async () => {
      await expect(cleanStaleWorktrees(repo.path)).resolves.toBeUndefined();
    });
  });
});

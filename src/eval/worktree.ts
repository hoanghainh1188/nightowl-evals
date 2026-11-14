import { randomBytes } from 'node:crypto';
import { lstat, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { runGit } from '../hooks/git/run-git.js';
import { ensurePrivateDir } from '../shared/private-dir.js';
import { DATA_DIR } from '../storage/data-dir.js';

export const WORKTREES_DIR = 'worktrees';
const COMMIT_SHA = /^[0-9a-f]{7,64}$/i;
const RESOLVE_TIMEOUT_MS = 10_000;
const CHECKOUT_TIMEOUT_MS = 120_000;
// Not a folder: git finds no hooks there, so checking out never runs the project's hooks.
const NO_HOOKS = '.no-hooks';

export interface CaseWorktree {
  readonly dir: string;
  readonly dispose: () => Promise<void>;
}

export type OpenCaseWorktree = (root: string, baseCommit: string) => Promise<CaseWorktree>;

export function isCommitSha(value: string): boolean {
  return COMMIT_SHA.test(value);
}

async function revParse(root: string, rev: string): Promise<string | null> {
  try {
    const out = await runGit(['rev-parse', '--verify', '--quiet', rev], {
      cwd: root,
      timeoutMs: RESOLVE_TIMEOUT_MS,
    });
    const sha = out.toString('utf8').trim();
    return sha === '' ? null : sha;
  } catch {
    return null;
  }
}

// The commit the developer started from: the parent of the commit that recorded the failure.
// Null when there is no usable commit (none, not a sha, unknown here, or a root commit).
export async function resolveParentCommit(root: string, commitSha: string | null): Promise<string | null> {
  if (commitSha === null || !isCommitSha(commitSha)) return null;
  const commit = await revParse(root, `${commitSha}^{commit}`);
  return commit === null ? null : revParse(root, `${commit}^1^{commit}`);
}

async function removeWorktree(root: string, dir: string): Promise<void> {
  try {
    await runGit(['worktree', 'remove', '--force', dir], { cwd: root, timeoutMs: CHECKOUT_TIMEOUT_MS });
  } catch {
    // Folder already gone or not registered: deleting it and pruning below still cleans up.
  }
  await rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
}

async function prune(root: string): Promise<void> {
  await runGit(['worktree', 'prune'], { cwd: root, timeoutMs: RESOLVE_TIMEOUT_MS }).catch(() => undefined);
}

// A detached checkout of `baseCommit` in .nightowl/worktrees/, so test commands never write to
// the developer's working tree. Inside the project, so Node finds the root node_modules.
export const openCaseWorktree: OpenCaseWorktree = async (root, baseCommit) => {
  const parent = await ensurePrivateDir(root, WORKTREES_DIR);
  const dir = join(parent, randomBytes(6).toString('hex'));
  try {
    await runGit(
      ['-c', `core.hooksPath=${join(parent, NO_HOOKS)}`, 'worktree', 'add', '--detach', '--quiet', dir, baseCommit],
      { cwd: root, timeoutMs: CHECKOUT_TIMEOUT_MS },
    );
  } catch {
    await removeWorktree(root, dir).catch(() => undefined);
    await prune(root);
    throw new Error(`worktree: cannot check out ${baseCommit.slice(0, 12)}`);
  }
  let disposed: Promise<void> | null = null;
  return Object.freeze({
    dir,
    dispose: () => {
      disposed ??= removeWorktree(root, dir).finally(() => prune(root));
      return disposed;
    },
  });
};

// Worktrees an interrupted run left behind. Refuses a symlinked folder: never deletes through it.
export async function cleanStaleWorktrees(root: string): Promise<void> {
  const parent = join(root, DATA_DIR, WORKTREES_DIR);
  let names: string[];
  try {
    const info = await lstat(parent);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`${parent} is not a directory`);
    names = await readdir(parent);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  for (const name of names) await removeWorktree(root, join(parent, name));
  await prune(root);
}

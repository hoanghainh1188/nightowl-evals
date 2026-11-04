import { chmod, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { GitError, runGit } from '../hooks/git/run-git.js';
import { isSymlink, readTextIfExists } from './fs-utils.js';

const MARKER = '# nightowl-evals';

// `|| true` keeps the commit going even if nightowl is missing or crashes.
export function hookLine(command: string): string {
  return `command -v nightowl >/dev/null 2>&1 && nightowl ${command} >/dev/null 2>&1 || true  ${MARKER}`;
}

export const HOOK_LINE = hookLine('precommit');

export interface GitHookSpec {
  readonly name: 'pre-commit' | 'post-commit';
  readonly command: string;
}

export const GIT_HOOKS: readonly GitHookSpec[] = Object.freeze([
  { name: 'pre-commit', command: 'precommit' },
  { name: 'post-commit', command: 'postcommit' },
]);
const SHELL_SHEBANG = /^#!\s*\S*(?:\/|\benv\s+)(?:sh|bash|zsh|dash|ksh)(?:\s|$)/;

export type HookEdit =
  | { readonly status: 'created' | 'updated'; readonly content: string }
  | { readonly status: 'unchanged' }
  | { readonly status: 'manual'; readonly reason: string };

export function addHookLine(existing: string | null, line: string = HOOK_LINE): HookEdit {
  if (existing === null) return { status: 'created', content: `#!/bin/sh\n${line}\n` };
  if (existing.split('\n').some((line) => line.trimEnd().endsWith(MARKER))) return { status: 'unchanged' };
  if (!existing.startsWith('#!')) return { status: 'updated', content: `#!/bin/sh\n${line}\n${existing}` };

  const newline = existing.indexOf('\n');
  const shebang = newline === -1 ? existing : existing.slice(0, newline);
  if (!SHELL_SHEBANG.test(shebang)) return { status: 'manual', reason: 'non-shell hook' };
  const rest = newline === -1 ? '' : existing.slice(newline + 1);
  return { status: 'updated', content: `${shebang}\n${line}\n${rest}` };
}

export type InstallResult =
  | { readonly status: 'created' | 'updated' | 'unchanged'; readonly path: string }
  | { readonly status: 'manual'; readonly reason: string };

async function gitText(root: string, args: readonly string[]): Promise<string | null> {
  try {
    return (await runGit(args, { cwd: root })).toString('utf8').trim();
  } catch (error) {
    // `git config --get` exits 1 when the key is unset.
    if (error instanceof GitError && error.exitCode === 1) return null;
    throw error;
  }
}

// Where git reads this hook, or why NightOwl must leave it to the user.
async function locateHook(root: string, hook: GitHookSpec): Promise<{ readonly path: string } | { readonly status: 'manual'; readonly reason: string }> {
  const hooksPath = await gitText(root, ['config', '--get', 'core.hooksPath']);
  if (hooksPath) return { status: 'manual', reason: `core.hooksPath is set to ${hooksPath}` };

  const relative = await gitText(root, ['rev-parse', '--git-path', `hooks/${hook.name}`]);
  if (!relative) throw new Error('could not locate the git hooks directory');
  const path = resolve(root, relative);
  // Writing through a symlink would change a script shared with other repositories.
  if (await isSymlink(path)) return { status: 'manual', reason: `${hook.name} hook is a symlink` };
  return { path };
}

export async function installGitHook(root: string, hook: GitHookSpec): Promise<InstallResult> {
  const located = await locateHook(root, hook);
  if (!('path' in located)) return located;
  const { path } = located;

  const edit = addHookLine(await readTextIfExists(path), hookLine(hook.command));
  if (edit.status === 'manual') return edit;
  if (edit.status === 'unchanged') return { status: 'unchanged', path };
  if (edit.status === 'created') {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, edit.content, { mode: 0o755 });
    await chmod(path, 0o755);
  } else {
    // Rewrite in place so the hook keeps its existing permissions.
    await writeFile(path, edit.content);
  }
  return { status: edit.status, path };
}

export type HookRemoval =
  | { readonly status: 'removed' | 'unchanged' }
  | { readonly status: 'updated'; readonly content: string };

const isNightowlLine = (line: string): boolean => line.trimEnd().endsWith(MARKER);

// Pure: drops NightOwl's line; `removed` when only a shebang would be left, which is what init created.
export function removeHookLine(existing: string): HookRemoval {
  const lines = existing.split('\n');
  const kept = lines.filter((line) => !isNightowlLine(line));
  if (kept.length === lines.length) return { status: 'unchanged' };
  const content = kept.join('\n');
  const onlyShebang = kept.filter((line) => line.trim() !== '').every((line) => line.startsWith('#!'));
  return onlyShebang ? { status: 'removed' } : { status: 'updated', content };
}

export type UninstallResult =
  | { readonly status: 'removed' | 'updated'; readonly path: string }
  // `path` is missing when the hook lives where NightOwl does not edit and does not run nightowl.
  | { readonly status: 'unchanged'; readonly path?: string }
  | { readonly status: 'manual'; readonly reason: string };

// Only worth a manual step when the hook NightOwl cannot edit actually runs it.
async function mentionsNightowl(root: string, hook: GitHookSpec): Promise<boolean> {
  const hooksPath = await gitText(root, ['config', '--get', 'core.hooksPath']);
  const relative = hooksPath || (await gitText(root, ['rev-parse', '--git-path', `hooks/${hook.name}`]));
  if (!relative) return false;
  const path = hooksPath ? resolve(root, hooksPath, hook.name) : resolve(root, relative);
  const content = await readTextIfExists(path).catch(() => null);
  return content !== null && content.includes(`nightowl ${hook.command}`);
}

export async function uninstallGitHook(root: string, hook: GitHookSpec): Promise<UninstallResult> {
  const located = await locateHook(root, hook);
  if (!('path' in located)) return (await mentionsNightowl(root, hook)) ? located : { status: 'unchanged' };
  const { path } = located;

  const existing = await readTextIfExists(path);
  const edit = existing === null ? { status: 'unchanged' as const } : removeHookLine(existing);
  if (edit.status === 'removed') await rm(path);
  // Rewrite in place so the hook keeps its existing permissions.
  if (edit.status === 'updated') await writeFile(path, edit.content);
  return { status: edit.status, path };
}

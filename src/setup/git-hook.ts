import { chmod, mkdir, writeFile } from 'node:fs/promises';
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

export async function installGitHook(root: string, hook: GitHookSpec): Promise<InstallResult> {
  const hooksPath = await gitText(root, ['config', '--get', 'core.hooksPath']);
  if (hooksPath) return { status: 'manual', reason: `core.hooksPath is set to ${hooksPath}` };

  const relative = await gitText(root, ['rev-parse', '--git-path', `hooks/${hook.name}`]);
  if (!relative) throw new Error('could not locate the git hooks directory');
  const path = resolve(root, relative);
  // Writing through a symlink would change a script shared with other repositories.
  if (await isSymlink(path)) return { status: 'manual', reason: `${hook.name} hook is a symlink` };

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

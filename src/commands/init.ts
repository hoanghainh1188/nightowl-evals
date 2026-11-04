import { relative } from 'node:path';
import { ensureClaudeHooks } from '../setup/claude-settings.js';
import { SetupError } from '../setup/fs-utils.js';
import { GIT_HOOKS, type GitHookSpec, hookLine, type InstallResult, installGitHook } from '../setup/git-hook.js';
import { ensureGitignoreEntry, type FileChange } from '../setup/gitignore.js';
import { isOnPath } from '../setup/path.js';
import { findProjectRoot } from '../storage/project-root.js';
import { DataDirError, openStore } from '../storage/store.js';
import type { Command } from './command.js';

export interface InitDeps {
  readonly cwd: () => string;
  readonly isOnPath: (command: string) => boolean;
  readonly installGitHook: (root: string, hook: GitHookSpec) => Promise<InstallResult>;
}

const defaultDeps: InitDeps = {
  cwd: () => process.cwd(),
  isOnPath: (command) => isOnPath(command, process.env.PATH),
  installGitHook,
};

async function tryInstallHook(deps: InitDeps, root: string, hook: GitHookSpec): Promise<InstallResult> {
  try {
    return await deps.installGitHook(root, hook);
  } catch (error) {
    return { status: 'manual', reason: error instanceof Error ? error.message : String(error) };
  }
}

function describeChange(file: string, change: FileChange, detail: string): string | null {
  return change === 'unchanged' ? null : `  ${change} ${file} (${detail})`;
}

export function createInitCommand(deps: InitDeps = defaultDeps): Command {
  return {
    name: 'init',
    summary: 'Set up NightOwl hooks in this project',
    run: async (_args, io) => {
      const root = findProjectRoot(deps.cwd());
      if (root === null) {
        io.stderr(`nightowl init: no git repository found at or above ${deps.cwd()}\n`);
        return 1;
      }

      // Settings first: if they are invalid, nothing else has been touched yet.
      let hooks;
      let gitignore;
      try {
        hooks = await ensureClaudeHooks(root);
        gitignore = await ensureGitignoreEntry(root);
        (await openStore({ cwd: root })).close();
      } catch (error) {
        if (!(error instanceof SetupError || error instanceof DataDirError)) throw error;
        io.stderr(`nightowl init: ${error.message}\nFix it and run 'nightowl init' again.\n`);
        return 1;
      }
      const gitHooks: Array<{ hook: GitHookSpec; result: InstallResult }> = [];
      for (const hook of GIT_HOOKS) gitHooks.push({ hook, result: await tryInstallHook(deps, root, hook) });

      const lines = [
        describeChange('.claude/settings.json', hooks.status, `hooks: ${hooks.added.join(', ')}`),
        describeChange('.gitignore', gitignore, 'added .nightowl/'),
        ...gitHooks.map(({ hook, result }) =>
          result.status === 'manual'
            ? null
            : describeChange(relative(root, result.path), result.status, `runs nightowl ${hook.command}`),
        ),
      ].filter((line): line is string => line !== null);
      io.stdout(
        lines.length === 0
          ? `NightOwl is already set up in ${root}\n`
          : `NightOwl is set up in ${root}\n${lines.join('\n')}\n`,
      );

      for (const { hook, result } of gitHooks) {
        if (result.status !== 'manual') continue;
        io.stderr(
          `nightowl init: git ${hook.name} hook not installed (${result.reason}).\n` +
            `  Add this line to your ${hook.name} hook yourself:\n  ${hookLine(hook.command)}\n`,
        );
      }
      if (!deps.isOnPath('nightowl')) {
        io.stderr(
          "nightowl init: warning: 'nightowl' is not on your PATH, so the hooks cannot run.\n" +
            '  Install it with: npm i -g @hoanghainh/nightowl-evals\n',
        );
      }
      return 0;
    },
  };
}

export const initCommand = createInitCommand();

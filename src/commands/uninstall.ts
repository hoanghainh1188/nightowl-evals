import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { renderCommandHelp } from '../cli/help.js';
import { errorMessage } from '../cli/errors.js';
import { printable } from '../shared/printable.js';
import { uninstallAllAgentHooks } from '../setup/agents-install.js';
import {
  assertNotSymlinked,
  PERSONAL_SETTINGS,
  readSettings,
  removeClaudeHooks,
  removeClaudeHooksFromFile,
  type RemoveStatus,
  SHARED_SETTINGS,
  type SettingsFile,
} from '../setup/claude-settings.js';
import { SetupError } from '../setup/fs-utils.js';
import { GIT_HOOKS, type GitHookSpec, hookLine, uninstallGitHook, type UninstallResult } from '../setup/git-hook.js';
import { findProjectRoot } from '../storage/project-root.js';
import { DATA_DIR } from '../storage/store.js';
import type { Command } from './command.js';
import { acceptsNoArguments } from './no-arguments.js';

export interface UninstallDeps {
  readonly cwd: () => string;
}

const SETTINGS_FILES: readonly SettingsFile[] = [PERSONAL_SETTINGS, SHARED_SETTINGS];

// Reads and checks both settings files before anything is changed, so a broken one stops the run cleanly.
async function checkSettings(root: string): Promise<ReadonlyMap<SettingsFile, number>> {
  const removable = new Map<SettingsFile, number>();
  for (const file of SETTINGS_FILES) {
    const { exists, value } = await readSettings(root, file);
    if (!exists) continue;
    let removed: number;
    try {
      removed = removeClaudeHooks(value).removed;
    } catch (error) {
      throw new SetupError(`${join(root, file)}: ${(error as Error).message}`);
    }
    if (removed > 0) await assertNotSymlinked(root, file);
    removable.set(file, removed);
  }
  return removable;
}

function settingsLine(file: string, status: RemoveStatus, removed: number): string | null {
  if (status === 'unchanged') return null;
  return status === 'removed' ? `  removed ${file}` : `  updated ${file} (removed ${removed} NightOwl ${removed === 1 ? 'hook' : 'hooks'})`;
}

function gitHookLine(root: string, result: UninstallResult): string | null {
  if (result.status === 'manual' || result.status === 'unchanged') return null;
  const file = relative(root, result.path);
  return result.status === 'removed' ? `  removed ${file}` : `  updated ${file} (removed the nightowl line)`;
}

function manualMessage(hook: GitHookSpec, result: UninstallResult): string | null {
  if (result.status !== 'manual') return null;
  return (
    `nightowl uninstall: git ${hook.name} hook not changed (${printable(result.reason)}).\n` +
    `  Remove the line that runs nightowl ${hook.command} yourself, for example:\n  ${hookLine(hook.command)}\n`
  );
}

export function createUninstallCommand(deps: UninstallDeps = { cwd: () => process.cwd() }): Command {
  return {
    name: 'uninstall',
    summary: 'Remove the hooks NightOwl added; keeps recorded data',
    help: renderCommandHelp({
      name: 'uninstall',
      usage: '',
      description: [
        `Removes NightOwl's Claude Code hooks from ${PERSONAL_SETTINGS} and ${SHARED_SETTINGS},`,
        'Cursor / Windsurf / Cline / Roo / Copilot Workspace / Aider NightOwl config entries,',
        'and its line from .git/hooks/pre-commit and post-commit. Everything else is kept.',
        `Recorded data in ${DATA_DIR}/ and .gitignore are left as they are.`,
      ],
      options: [],
    }),
    run: async (args, io) => {
      if (!acceptsNoArguments('uninstall', args, io)) return 1;
      const root = findProjectRoot(deps.cwd());
      if (root === null) {
        io.stderr(`nightowl uninstall: no git repository found at or above ${deps.cwd()}\n`);
        return 1;
      }

      const lines: Array<string | null> = [];
      try {
        const removable = await checkSettings(root);
        for (const [file, removed] of removable) {
          lines.push(settingsLine(file, await removeClaudeHooksFromFile(root, file), removed));
        }
      } catch (error) {
        if (!(error instanceof SetupError)) throw error;
        io.stderr(`nightowl uninstall: ${printable(error.message)}\nFix it and run 'nightowl uninstall' again.\n`);
        return 1;
      }
      for (const row of await uninstallAllAgentHooks(root)) {
        if (row.warning) io.stderr(`nightowl uninstall: warning: ${row.file}: ${row.warning}\n`);
        if (row.status !== 'unchanged') {
          lines.push(
            row.status === 'removed'
              ? `  removed ${row.file}`
              : `  updated ${row.file} (${row.detail})`,
          );
        }
      }
      const manual: Array<string | null> = [];
      try {
        for (const hook of GIT_HOOKS) {
          const result = await uninstallGitHook(root, hook);
          lines.push(gitHookLine(root, result));
          manual.push(manualMessage(hook, result));
        }
      } catch (error) {
        io.stderr(`nightowl uninstall: could not change a git hook (${printable(errorMessage(error))}).\n`);
        return 1;
      }

      const changed = lines.filter((line): line is string => line !== null);
      const dataNote = existsSync(join(root, DATA_DIR))
        ? `Your data is kept in ${DATA_DIR}/. Delete it yourself if you no longer need it.\n`
        : '';
      io.stdout(
        changed.length === 0
          ? `Nothing to remove: NightOwl is not set up in ${root}\n${dataNote}`
          : `NightOwl is removed from ${root}\n${changed.join('\n')}\n${dataNote}`,
      );
      for (const message of manual) if (message !== null) io.stderr(message);
      return 0;
    },
  };
}

export const uninstallCommand = createUninstallCommand();

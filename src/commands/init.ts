import { ClaudeSettingsError, ensureClaudeHooks } from '../setup/claude-settings.js';
import { ensureGitignoreEntry, type FileChange } from '../setup/gitignore.js';
import { isOnPath } from '../setup/path.js';
import { findProjectRoot } from '../storage/project-root.js';
import { openStore } from '../storage/store.js';
import type { Command } from './command.js';

export interface InitDeps {
  readonly cwd: () => string;
  readonly isOnPath: (command: string) => boolean;
}

const defaultDeps: InitDeps = {
  cwd: () => process.cwd(),
  isOnPath: (command) => isOnPath(command, process.env.PATH),
};

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
      try {
        hooks = await ensureClaudeHooks(root);
      } catch (error) {
        if (!(error instanceof ClaudeSettingsError)) throw error;
        io.stderr(`nightowl init: ${error.message}\nFix the file and run 'nightowl init' again.\n`);
        return 1;
      }
      const gitignore = await ensureGitignoreEntry(root);
      (await openStore({ cwd: root })).close();

      const lines = [
        describeChange('.claude/settings.json', hooks.status, `hooks: ${hooks.added.join(', ')}`),
        describeChange('.gitignore', gitignore, 'added .nightowl/'),
      ].filter((line): line is string => line !== null);
      io.stdout(
        lines.length === 0
          ? `NightOwl is already set up in ${root}\n`
          : `NightOwl is set up in ${root}\n${lines.join('\n')}\n`,
      );

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

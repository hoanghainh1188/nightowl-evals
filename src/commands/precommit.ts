import { checkStagedChanges } from '../hooks/git/check-commit.js';
import type { Command } from './command.js';
import { createGitHookCommand, type GitHookDeps } from './git-hook-command.js';

export function createPrecommitCommand(deps: GitHookDeps = { cwd: () => process.cwd() }): Command {
  return createGitHookCommand(
    {
      name: 'precommit',
      summary: 'Compare staged files with AI edits (used by the git hook)',
      description: [
        'Compares each staged file with what Claude Code last wrote to it.',
        'Called by the git pre-commit hook; you do not run it yourself. Always exits 0 and prints nothing.',
      ],
      run: checkStagedChanges,
    },
    deps,
  );
}

export const precommitCommand = createPrecommitCommand();

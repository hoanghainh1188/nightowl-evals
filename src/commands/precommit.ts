import { checkStagedChanges } from '../hooks/git/check-commit.js';
import type { Command } from './command.js';
import { createGitHookCommand, type GitHookDeps } from './git-hook-command.js';

export function createPrecommitCommand(deps: GitHookDeps = { cwd: () => process.cwd() }): Command {
  return createGitHookCommand(
    { name: 'precommit', summary: 'Compare staged files with AI edits (used by the git hook)', run: checkStagedChanges },
    deps,
  );
}

export const precommitCommand = createPrecommitCommand();

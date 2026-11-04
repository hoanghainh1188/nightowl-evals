import { attachCommit } from '../hooks/git/attach-commit.js';
import type { Command } from './command.js';
import { createGitHookCommand, type GitHookDeps } from './git-hook-command.js';

export function createPostcommitCommand(deps: GitHookDeps = { cwd: () => process.cwd() }): Command {
  return createGitHookCommand(
    { name: 'postcommit', summary: 'Record failures from the commit just made (used by the git hook)', run: attachCommit },
    deps,
  );
}

export const postcommitCommand = createPostcommitCommand();

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { appendErrorLog } from '../hooks/error-log.js';
import { findProjectRoot } from '../storage/project-root.js';
import { DATA_DIR } from '../storage/store.js';
import type { Command } from './command.js';

export const GIT_HOOK_BUDGET_MS = 2_000;

export interface GitHookDeps {
  readonly cwd: () => string;
  readonly budgetMs?: number;
}

interface GitHookAction {
  readonly name: string;
  readonly summary: string;
  readonly run: (root: string, deadline: number) => Promise<unknown>;
}

// Commands called by git hooks: they must never fail, print or block the commit.
export function createGitHookCommand(action: GitHookAction, deps: GitHookDeps): Command {
  return {
    name: action.name,
    summary: action.summary,
    run: async () => {
      const deadline = Date.now() + (deps.budgetMs ?? GIT_HOOK_BUDGET_MS);
      let root: string | null = null;
      try {
        root = findProjectRoot(deps.cwd());
        if (root !== null) await action.run(root, deadline);
      } catch (error) {
        if (root !== null && existsSync(join(root, DATA_DIR))) await appendErrorLog(root, action.name, error);
      }
      return 0;
    },
  };
}

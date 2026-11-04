import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { appendErrorLog } from '../hooks/error-log.js';
import { checkStagedChanges } from '../hooks/git/check-commit.js';
import { findProjectRoot } from '../storage/project-root.js';
import { DATA_DIR } from '../storage/store.js';
import type { Command } from './command.js';

export const PRECOMMIT_BUDGET_MS = 2_000;

export interface PrecommitDeps {
  readonly cwd: () => string;
  readonly budgetMs?: number;
}

// Called by the git pre-commit hook: it must never fail, print or block the commit.
export function createPrecommitCommand(deps: PrecommitDeps = { cwd: () => process.cwd() }): Command {
  return {
    name: 'precommit',
    summary: 'Compare staged files with AI edits (used by the git hook)',
    run: async () => {
      const root = findProjectRoot(deps.cwd());
      if (root === null) return 0;
      try {
        await checkStagedChanges(root, Date.now() + (deps.budgetMs ?? PRECOMMIT_BUDGET_MS));
      } catch (error) {
        if (existsSync(join(root, DATA_DIR))) await appendErrorLog(root, 'precommit', error);
      }
      return 0;
    },
  };
}

export const precommitCommand = createPrecommitCommand();

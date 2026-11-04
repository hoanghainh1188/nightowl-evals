import { errorMessage } from '../cli/errors.js';
import { openStore, ProjectNotFoundError } from '../storage/store.js';
import type { Command } from './command.js';

export interface FailuresDeps {
  readonly cwd: () => string;
}

export function createFailuresCommand(deps: FailuresDeps = { cwd: () => process.cwd() }): Command {
  return {
    name: 'failures',
    summary: 'Count the failure records collected so far',
    run: async (_args, io) => {
      let counts;
      try {
        const store = await openStore({ cwd: deps.cwd() });
        try {
          counts = store.countFailures();
        } finally {
          store.close();
        }
      } catch (error) {
        const message = error instanceof ProjectNotFoundError ? `no git repository found at or above ${error.cwd}` : errorMessage(error);
        io.stderr(`nightowl failures: ${message}\n`);
        return 1;
      }
      const lines = Object.entries(counts.byStatus).map(([status, n]) => `  ${status}: ${n}`);
      io.stdout(`${counts.total} ${counts.total === 1 ? 'failure' : 'failures'} recorded\n${lines.map((l) => `${l}\n`).join('')}`);
      return 0;
    },
  };
}

export const failuresCommand = createFailuresCommand();

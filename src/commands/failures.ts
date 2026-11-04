import { errorMessage } from '../cli/errors.js';
import { renderCommandHelp } from '../cli/help.js';
import { printable } from '../shared/printable.js';
import type { Command } from './command.js';
import { openExistingStore } from './existing-store.js';
import { acceptsNoArguments } from './no-arguments.js';

export interface FailuresDeps {
  readonly cwd: () => string;
}

export function createFailuresCommand(deps: FailuresDeps = { cwd: () => process.cwd() }): Command {
  return {
    name: 'failures',
    summary: 'Count the failure records collected so far',
    help: renderCommandHelp({
      name: 'failures',
      usage: '',
      description: ['Prints how many failures have been recorded, per status.'],
      options: [],
    }),
    run: async (args, io) => {
      if (!acceptsNoArguments('failures', args, io)) return 1;
      // Read-only: never creates .nightowl/ or upgrades the database.
      const store = await openExistingStore(deps.cwd());
      if (typeof store === 'string') {
        io.stderr(`nightowl failures: ${store}\n`);
        return 1;
      }
      let counts;
      try {
        counts = store.countFailures();
      } catch (error) {
        io.stderr(`nightowl failures: ${printable(errorMessage(error))}\n`);
        return 1;
      } finally {
        store.close();
      }
      const lines = Object.entries(counts.byStatus).map(([status, n]) => `  ${status}: ${n}`);
      io.stdout(`${counts.total} ${counts.total === 1 ? 'failure' : 'failures'} recorded\n${lines.map((l) => `${l}\n`).join('')}`);
      return 0;
    },
  };
}

export const failuresCommand = createFailuresCommand();

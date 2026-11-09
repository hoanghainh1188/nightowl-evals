import { parseArgs } from 'node:util';
import { errorMessage } from '../cli/errors.js';
import { renderCommandHelp } from '../cli/help.js';
import type { Io } from '../cli/io.js';
import { printable } from '../shared/printable.js';
import type { PruneResult } from '../storage/prune.js';
import type { Store } from '../storage/store.js';
import type { Command } from './command.js';
import { openExistingStore, openExistingStoreForWrite } from './existing-store.js';

export const DEFAULT_PRUNE_DAYS = 30;

export interface PruneDeps {
  readonly cwd: () => string;
  readonly now: () => Date;
  readonly openStore: (cwd: string, readOnly: boolean) => Promise<Store | string>;
}

export const defaultPruneDeps: PruneDeps = {
  cwd: () => process.cwd(),
  now: () => new Date(),
  openStore: (cwd, readOnly) => (readOnly ? openExistingStore(cwd) : openExistingStoreForWrite(cwd)),
};

interface ParsedOptions {
  readonly days: number;
  readonly dryRun: boolean;
  readonly vacuum: boolean;
}

function parseOptions(args: readonly string[]): ParsedOptions | string {
  let values;
  try {
    values = parseArgs({
      args: [...args],
      options: {
        days: { type: 'string' },
        'dry-run': { type: 'boolean' },
        vacuum: { type: 'boolean' },
      },
      strict: true,
      allowPositionals: false,
    }).values;
  } catch (error) {
    return errorMessage(error);
  }

  let days = DEFAULT_PRUNE_DAYS;
  if (values.days !== undefined) {
    const parsed = Number(values.days);
    if (!Number.isInteger(parsed) || parsed < 1) {
      return '--days must be a whole number greater than 0';
    }
    days = parsed;
  }

  return {
    days,
    dryRun: values['dry-run'] === true,
    vacuum: values.vacuum === true,
  };
}

export function createPruneCommand(deps: PruneDeps = defaultPruneDeps): Command {
  return {
    name: 'prune',
    summary: 'Prune old event snapshots and optimize local SQLite storage',
    help: renderCommandHelp({
      name: 'prune',
      usage: '[options]',
      description: [
        'Prunes file snapshots from events older than N days to save disk space,',
        'while keeping event records and evaluation failures intact.',
      ],
      options: [
        ['--days <n>', `Retention threshold in days (default: ${DEFAULT_PRUNE_DAYS})`],
        ['--dry-run', 'Preview how many snapshots would be pruned without modifying the database'],
        ['--vacuum', 'Run VACUUM to reclaim free disk space after pruning'],
      ],
    }),
    run: async (args: readonly string[], io: Io): Promise<number> => {
      const parsed = parseOptions(args);
      if (typeof parsed === 'string') {
        io.stderr(`nightowl prune: ${printable(parsed)}\nRun 'nightowl prune --help'.\n`);
        return 1;
      }

      const cwd = deps.cwd();
      const storeResult = await deps.openStore(cwd, parsed.dryRun);
      if (typeof storeResult === 'string') {
        io.stderr(`nightowl prune: ${storeResult}\n`);
        return 1;
      }

      const store = storeResult;
      try {
        const result: PruneResult = store.prune({
          olderThanDays: parsed.days,
          dryRun: parsed.dryRun,
          now: deps.now(),
        });

        const dayWord = parsed.days === 1 ? 'day' : 'days';
        const snapshotWord = result.snapshotsPruned === 1 ? 'snapshot' : 'snapshots';

        if (parsed.dryRun) {
          io.stdout(
            `Dry-run: ${result.snapshotsPruned} ${snapshotWord} would be pruned (older than ${parsed.days} ${dayWord}, before ${result.cutoffDate}).\n`,
          );
        } else {
          io.stdout(
            `Pruned ${result.snapshotsPruned} ${snapshotWord} (older than ${parsed.days} ${dayWord}, before ${result.cutoffDate}).\n`,
          );
          if (parsed.vacuum) {
            store.vacuum();
            io.stdout('Database vacuum completed.\n');
          }
        }
        return 0;
      } finally {
        store.close();
      }
    },
  };
}

export const pruneCommand = createPruneCommand();

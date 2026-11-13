import { join } from 'node:path';
import { stat } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { errorMessage } from '../cli/errors.js';
import { renderCommandHelp } from '../cli/help.js';
import type { Io } from '../cli/io.js';
import { printable } from '../shared/printable.js';
import {
  isRetentionProfile,
  RETENTION_PROFILES,
  type PruneResult,
  type RetentionProfile,
} from '../storage/prune.js';
import { DATA_DIR, DB_FILE, type Store } from '../storage/store.js';
import type { Command } from './command.js';
import { openExistingStore, openExistingStoreForWrite } from './existing-store.js';

export const DEFAULT_PRUNE_DAYS: number = RETENTION_PROFILES.default;

export interface PruneDeps {
  readonly cwd: () => string;
  readonly now: () => Date;
  readonly openStore: (cwd: string, readOnly: boolean) => Promise<Store | string>;
  readonly statFile?: (path: string) => Promise<{ size: number }>;
}

export const defaultPruneDeps: PruneDeps = {
  cwd: () => process.cwd(),
  now: () => new Date(),
  openStore: (cwd, readOnly) => (readOnly ? openExistingStore(cwd) : openExistingStoreForWrite(cwd)),
  statFile: async (path) => stat(path),
};

interface ParsedOptions {
  readonly days: number;
  readonly dryRun: boolean;
  readonly vacuum: boolean;
  readonly profile: RetentionProfile | null;
  readonly daysExplicit: boolean;
}

function parseOptions(args: readonly string[]): ParsedOptions | string {
  let values;
  try {
    values = parseArgs({
      args: [...args],
      options: {
        days: { type: 'string' },
        profile: { type: 'string' },
        'dry-run': { type: 'boolean' },
        vacuum: { type: 'boolean' },
      },
      strict: true,
      allowPositionals: false,
    }).values;
  } catch (error) {
    return errorMessage(error);
  }

  let profile: RetentionProfile | null = null;
  if (values.profile !== undefined) {
    if (!isRetentionProfile(values.profile)) {
      const known = Object.keys(RETENTION_PROFILES).join(', ');
      return `--profile must be one of: ${known}`;
    }
    profile = values.profile;
  }

  let daysExplicit = false;
  let days: number = DEFAULT_PRUNE_DAYS;
  if (profile !== null) days = RETENTION_PROFILES[profile];
  if (values.days !== undefined) {
    const parsed = Number(values.days);
    if (!Number.isInteger(parsed) || parsed < 1) {
      return '--days must be a whole number greater than 0';
    }
    days = parsed;
    daysExplicit = true;
  }

  return {
    days,
    dryRun: values['dry-run'] === true,
    vacuum: values.vacuum === true,
    profile,
    daysExplicit,
  };
}

function formatPruneLine(kind: 'dry-run' | 'pruned', result: PruneResult, days: number): string {
  const dayWord = days === 1 ? 'day' : 'days';
  const snapshotWord = result.snapshotsPruned === 1 ? 'snapshot' : 'snapshots';
  const byteWord = result.bytesEstimated === 1 ? 'byte' : 'bytes';
  const head =
    kind === 'dry-run'
      ? `Dry-run: ${result.snapshotsPruned} ${snapshotWord} (~${result.bytesEstimated} ${byteWord} of snapshot data) would be pruned`
      : `Pruned ${result.snapshotsPruned} ${snapshotWord} (~${result.bytesEstimated} ${byteWord} of snapshot data)`;
  return `${head} (older than ${days} ${dayWord}, before ${result.cutoffDate}).\n`;
}

export function createPruneCommand(deps: PruneDeps = defaultPruneDeps): Command {
  const statFile = deps.statFile ?? ((path: string) => stat(path));
  return {
    name: 'prune',
    summary: 'Prune old event snapshots and optimize local SQLite storage',
    help: renderCommandHelp({
      name: 'prune',
      usage: '[options]',
      description: [
        'Prunes file snapshots from events older than N days to save disk space,',
        'while keeping event records and evaluation failures intact.',
        'Reports estimated snapshot bytes removed (payload length). With --vacuum,',
        'prints database file size before and after VACUUM. --vacuum is skipped in --dry-run.',
      ],
      options: [
        ['--days <n>', `Retention threshold in days (default: ${DEFAULT_PRUNE_DAYS}; overrides --profile)`],
        [
          '--profile <short|default|long>',
          `Named retention: short=${RETENTION_PROFILES.short}, default=${RETENTION_PROFILES.default}, long=${RETENTION_PROFILES.long} days`,
        ],
        ['--dry-run', 'Preview snapshot count and estimated bytes without modifying the database'],
        ['--vacuum', 'Run VACUUM after pruning and report DB file size before/after (skipped with --dry-run)'],
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
        if (parsed.profile !== null && parsed.daysExplicit) {
          io.stderr(
            `nightowl prune: warning: --days ${parsed.days} overrides --profile ${parsed.profile}\n`,
          );
        }

        const result: PruneResult = store.prune({
          olderThanDays: parsed.days,
          dryRun: parsed.dryRun,
          now: deps.now(),
        });

        if (parsed.dryRun) {
          io.stdout(formatPruneLine('dry-run', result, parsed.days));
          if (parsed.vacuum) {
            io.stderr('nightowl prune: warning: --vacuum skipped in dry-run\n');
          }
          return 0;
        }

        io.stdout(formatPruneLine('pruned', result, parsed.days));

        if (parsed.vacuum) {
          const dbPath = join(store.root, DATA_DIR, DB_FILE);
          const before = (await statFile(dbPath)).size;
          store.vacuum();
          const after = (await statFile(dbPath)).size;
          const delta = after - before;
          const signed = delta > 0 ? `+${delta}` : `${delta}`;
          io.stdout(`Database vacuum completed (${before} → ${after} bytes, ${signed}).\n`);
        }
        return 0;
      } finally {
        store.close();
      }
    },
  };
}

export const pruneCommand = createPruneCommand();

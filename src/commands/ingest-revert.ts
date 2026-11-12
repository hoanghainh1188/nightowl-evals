import { parseArgs } from 'node:util';
import { errorMessage } from '../cli/errors.js';
import { renderCommandHelp } from '../cli/help.js';
import { ingestRevertCommits, listRevertCommits } from '../ingest/scan-reverts.js';
import { parseDateOption } from '../shared/date-option.js';
import { printable } from '../shared/printable.js';
import type { Command } from './command.js';
import { openExistingStoreForWrite } from './existing-store.js';

/** Default lookback when --since is omitted (calendar days, UTC). */
export const DEFAULT_REVERT_LOOKBACK_DAYS = 30;

export interface IngestRevertDeps {
  readonly cwd: () => string;
  readonly now: () => Date;
  readonly listReverts?: typeof listRevertCommits;
}

interface Options {
  readonly since: string;
}

function defaultSinceDate(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - DEFAULT_REVERT_LOOKBACK_DAYS);
  return d.toISOString().slice(0, 10);
}

function parseOptions(args: readonly string[], now: Date): Options | string {
  let values;
  try {
    values = parseArgs({
      args: [...args],
      options: {
        since: { type: 'string' },
      },
      strict: true,
      allowPositionals: false,
    }).values;
  } catch (error) {
    return errorMessage(error);
  }
  if (values.since === undefined) return { since: defaultSinceDate(now) };
  const iso = parseDateOption(values.since);
  if (iso === null) return `invalid --since date (use YYYY-MM-DD): ${values.since}`;
  return { since: values.since };
}

export function createIngestRevertCommand(
  deps: IngestRevertDeps = { cwd: () => process.cwd(), now: () => new Date() },
): Command {
  return {
    name: 'ingest-revert',
    summary: 'Ingest git revert commits that match stored failure commit SHAs',
    help: renderCommandHelp({
      name: 'ingest-revert',
      usage: '[options]',
      description: [
        'Scans local git history for standard "This reverts commit <sha>" messages and records',
        'revert events when the reverted SHA matches a failure.commit_sha in the project store.',
        'Does not invent failures.ai_content and does not call the network.',
        'Requires an existing NightOwl database (run nightowl init first) and a git working tree.',
        'Limitations: squash merges, rewritten history, cherry-picks, and manual reverts without',
        'the standard git revert message may not be detected.',
      ],
      options: [
        [
          '--since <YYYY-MM-DD>',
          `Only scan commits on or after this date (default: ${DEFAULT_REVERT_LOOKBACK_DAYS} days ago)`,
        ],
      ],
    }),
    run: async (args, io) => {
      const options = parseOptions(args, deps.now());
      if (typeof options === 'string') {
        io.stderr(`nightowl ingest-revert: ${options}\n`);
        return 1;
      }
      const store = await openExistingStoreForWrite(deps.cwd());
      if (typeof store === 'string') {
        io.stderr(`nightowl ingest-revert: ${store}\n`);
        return 1;
      }
      try {
        const list = deps.listReverts ?? listRevertCommits;
        const reverts = await list(store.root, options.since);
        const result = ingestRevertCommits(store, reverts);
        io.stdout(
          `Ingested revert signals: ${result.inserted} new, ${result.skipped} duplicate` +
            ` (${result.scanned} revert commit(s) scanned, ${result.unmatched} unmatched)\n`,
        );
        return 0;
      } catch (error) {
        io.stderr(`nightowl ingest-revert: ${printable(errorMessage(error))}\n`);
        return 1;
      } finally {
        store.close();
      }
    },
  };
}

export const ingestRevertCommand = createIngestRevertCommand();

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { errorMessage } from '../cli/errors.js';
import { renderCommandHelp } from '../cli/help.js';
import { prDedupeKey } from '../ingest/fingerprint.js';
import { fetchPullReviewComments, GithubPrError } from '../ingest/github-pr.js';
import { linkAgentForFile } from '../ingest/link-agent.js';
import { parsePrCommentsJson, type PrReviewRecord } from '../ingest/pr-comments.js';
import { printable } from '../shared/printable.js';
import type { Store } from '../storage/store.js';
import type { Command } from './command.js';
import { openExistingStoreForWrite } from './existing-store.js';

export interface IngestPrDeps {
  readonly cwd: () => string;
  readonly env?: () => NodeJS.ProcessEnv;
  readonly readFile?: (path: string) => Promise<string>;
  readonly fetch?: typeof fetch;
}

interface Options {
  readonly file: string | null;
  readonly github: boolean;
  readonly pr: string | null;
}

function parseOptions(args: readonly string[]): Options | string {
  let values;
  try {
    values = parseArgs({
      args: [...args],
      options: {
        file: { type: 'string' },
        github: { type: 'boolean' },
        pr: { type: 'string' },
      },
      strict: true,
      allowPositionals: false,
    }).values;
  } catch (error) {
    return errorMessage(error);
  }
  const file = values.file === undefined ? null : values.file.trim();
  if (file !== null && file.length === 0) return '--file cannot be empty';
  const github = values.github === true;
  const pr = values.pr === undefined ? null : values.pr.trim();
  if (pr !== null && (pr.length === 0 || !/^\d+$/.test(pr))) return '--pr must be a positive integer';
  if (!github && file === null) return 'provide --file <path>, or --github with --pr / env';
  if (github && file !== null) return 'use either --file or --github, not both';
  return { file, github, pr };
}

export function ingestPrRecords(store: Store, records: readonly PrReviewRecord[]): { inserted: number; skipped: number } {
  const before = store.countEventsByKind(['pr-review'], null)['pr-review'] ?? 0;
  for (const record of records) {
    const dedupeKey = prDedupeKey({
      commentId: record.commentId,
      pr: record.pr,
      path: record.path,
      line: record.line,
      bodyPrefix: record.body.slice(0, 160),
    });
    const link = linkAgentForFile(store, record.path);
    store.insertEvent({
      source: 'pr',
      kind: 'pr-review',
      filePath: record.path,
      agent: link.agent,
      ...(dedupeKey !== null ? { dedupeKey } : {}),
      payload: {
        comment_id: record.commentId,
        body: record.body,
        commit_id: record.commitId,
        user: record.user,
        line: record.line,
        pr: record.pr,
        related_event_id: link.relatedEventId,
      },
    });
  }
  const after = store.countEventsByKind(['pr-review'], null)['pr-review'] ?? 0;
  const inserted = after - before;
  return { inserted, skipped: Math.max(0, records.length - inserted) };
}

export function createIngestPrCommand(deps: IngestPrDeps = { cwd: () => process.cwd() }): Command {
  return {
    name: 'ingest-pr',
    summary: 'Ingest PR review comments from a local JSON file (or opt-in GitHub API)',
    help: renderCommandHelp({
      name: 'ingest-pr',
      usage: '[--file <path> | --github] [options]',
      description: [
        'Records pr-review events from a local JSON comments file by default (no network).',
        'Does not invent failures.ai_content.',
        'GitHub API fetch runs only with --github and GITHUB_TOKEN (plus GITHUB_REPOSITORY and --pr).',
        'Requires an existing NightOwl database (run nightowl init first).',
      ],
      options: [
        ['--file <path>', 'Local JSON comments file (array or { "comments": [...] })'],
        ['--github', 'Opt-in: fetch review comments via GitHub API (needs token)'],
        ['--pr <n>', 'Pull request number (required with --github; optional metadata for --file)'],
      ],
    }),
    run: async (args, io) => {
      const options = parseOptions(args);
      if (typeof options === 'string') {
        io.stderr(`nightowl ingest-pr: ${options}\n`);
        return 1;
      }
      const env = (deps.env ?? (() => process.env))();
      const store = await openExistingStoreForWrite(deps.cwd());
      if (typeof store === 'string') {
        io.stderr(`nightowl ingest-pr: ${store}\n`);
        return 1;
      }
      try {
        let records: readonly PrReviewRecord[];
        if (options.github) {
          const token = env.GITHUB_TOKEN?.trim() ?? '';
          if (token.length === 0) {
            io.stderr('nightowl ingest-pr: --github requires GITHUB_TOKEN in the environment\n');
            return 1;
          }
          const repository = env.GITHUB_REPOSITORY?.trim() ?? '';
          if (repository.length === 0) {
            io.stderr('nightowl ingest-pr: --github requires GITHUB_REPOSITORY (owner/repo)\n');
            return 1;
          }
          const prRaw = options.pr ?? env.GITHUB_PR_NUMBER?.trim() ?? '';
          if (prRaw.length === 0 || !/^\d+$/.test(prRaw)) {
            io.stderr('nightowl ingest-pr: --github requires --pr <n> (or GITHUB_PR_NUMBER)\n');
            return 1;
          }
          try {
            const fetchImpl = deps.fetch;
            records =
              fetchImpl === undefined
                ? await fetchPullReviewComments({ token, repository, pr: Number(prRaw) })
                : await fetchPullReviewComments({ token, repository, pr: Number(prRaw), fetch: fetchImpl });
          } catch (error) {
            const message = error instanceof GithubPrError ? error.message : errorMessage(error);
            io.stderr(`nightowl ingest-pr: ${printable(message)}\n`);
            return 1;
          }
        } else {
          const absolute = resolve(deps.cwd(), options.file!);
          const read = deps.readFile ?? ((path) => readFile(path, 'utf8'));
          let content: string;
          try {
            content = await read(absolute);
          } catch (error) {
            io.stderr(`nightowl ingest-pr: cannot read file: ${printable(errorMessage(error))}\n`);
            return 1;
          }
          try {
            records = parsePrCommentsJson(content, options.pr);
          } catch (error) {
            io.stderr(`nightowl ingest-pr: ${printable(errorMessage(error))}\n`);
            return 1;
          }
        }
        const result = ingestPrRecords(store, records);
        io.stdout(
          `Ingested PR signals: ${result.inserted} new, ${result.skipped} duplicate (of ${records.length} comment(s))\n`,
        );
        return 0;
      } finally {
        store.close();
      }
    },
  };
}

export const ingestPrCommand = createIngestPrCommand();

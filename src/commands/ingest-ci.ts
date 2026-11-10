import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { errorMessage } from '../cli/errors.js';
import { renderCommandHelp } from '../cli/help.js';
import { parseCiJson } from '../ingest/ci-json.js';
import { ciDedupeKey } from '../ingest/fingerprint.js';
import type { CiFailRecord } from '../ingest/junit.js';
import { parseJunitXml } from '../ingest/junit.js';
import { linkAgentForFile } from '../ingest/link-agent.js';
import { printable } from '../shared/printable.js';
import type { Store } from '../storage/store.js';
import type { Command } from './command.js';
import { openExistingStoreForWrite } from './existing-store.js';

export interface IngestCiDeps {
  readonly cwd: () => string;
  readonly readFile?: (path: string) => Promise<string>;
}

interface Options {
  readonly file: string;
  readonly format: 'junit' | 'json' | 'auto';
  readonly commit: string | null;
}

function detectFormat(path: string, format: 'junit' | 'json' | 'auto'): 'junit' | 'json' {
  if (format !== 'auto') return format;
  const ext = extname(path).toLowerCase();
  if (ext === '.json') return 'json';
  return 'junit';
}

function parseOptions(args: readonly string[]): Options | string {
  let values;
  try {
    values = parseArgs({
      args: [...args],
      options: {
        file: { type: 'string' },
        format: { type: 'string' },
        commit: { type: 'string' },
      },
      strict: true,
      allowPositionals: false,
    }).values;
  } catch (error) {
    return errorMessage(error);
  }
  const file = values.file?.trim();
  if (file === undefined || file.length === 0) return '--file is required (JUnit XML or JSON summary path)';
  const formatRaw = values.format ?? 'auto';
  if (formatRaw !== 'auto' && formatRaw !== 'junit' && formatRaw !== 'json') {
    return `--format must be auto, junit, or json (got: ${formatRaw})`;
  }
  const commit = values.commit === undefined ? null : values.commit.trim();
  if (commit !== null && commit.length === 0) return '--commit cannot be empty';
  return { file, format: formatRaw, commit };
}

function parseRecords(content: string, format: 'junit' | 'json', commit: string | null): readonly CiFailRecord[] {
  return format === 'json' ? parseCiJson(content, commit) : parseJunitXml(content, commit);
}

export function ingestCiRecords(store: Store, records: readonly CiFailRecord[]): { inserted: number; skipped: number } {
  const before = store.countEventsByKind(['ci-fail'], null)['ci-fail'] ?? 0;
  for (const record of records) {
    const dedupeKey = ciDedupeKey({
      commitSha: record.commitSha,
      suite: record.suite,
      classname: record.classname,
      name: record.testName,
      file: record.filePath,
    });
    const link = linkAgentForFile(store, record.filePath);
    store.insertEvent({
      source: 'ci',
      kind: 'ci-fail',
      filePath: record.filePath,
      agent: link.agent,
      ...(dedupeKey !== null ? { dedupeKey } : {}),
      payload: {
        test_name: record.testName,
        classname: record.classname,
        suite: record.suite,
        message: record.message,
        commit_sha: record.commitSha,
        related_event_id: link.relatedEventId,
      },
    });
  }
  const after = store.countEventsByKind(['ci-fail'], null)['ci-fail'] ?? 0;
  const inserted = after - before;
  return { inserted, skipped: Math.max(0, records.length - inserted) };
}

export function createIngestCiCommand(deps: IngestCiDeps = { cwd: () => process.cwd() }): Command {
  return {
    name: 'ingest-ci',
    summary: 'Ingest CI test failures from a local JUnit/JSON file into events',
    help: renderCommandHelp({
      name: 'ingest-ci',
      usage: '--file <path> [options]',
      description: [
        'Reads a local JUnit XML or JSON summary file and records ci-fail events in the project store.',
        'Does not invent failures.ai_content and does not call the network.',
        'Requires an existing NightOwl database (run nightowl init first).',
      ],
      options: [
        ['--file <path>', 'JUnit XML or JSON summary path (required)'],
        ['--format auto|junit|json', 'Input format (default: auto by extension)'],
        ['--commit <sha>', 'Optional commit SHA attached to each record'],
      ],
    }),
    run: async (args, io) => {
      const options = parseOptions(args);
      if (typeof options === 'string') {
        io.stderr(`nightowl ingest-ci: ${options}\n`);
        return 1;
      }
      const store = await openExistingStoreForWrite(deps.cwd());
      if (typeof store === 'string') {
        io.stderr(`nightowl ingest-ci: ${store}\n`);
        return 1;
      }
      try {
        const absolute = resolve(deps.cwd(), options.file);
        const read = deps.readFile ?? ((path) => readFile(path, 'utf8'));
        let content: string;
        try {
          content = await read(absolute);
        } catch (error) {
          io.stderr(`nightowl ingest-ci: cannot read file: ${printable(errorMessage(error))}\n`);
          return 1;
        }
        const format = detectFormat(absolute, options.format);
        let records: readonly CiFailRecord[];
        try {
          records = parseRecords(content, format, options.commit);
        } catch (error) {
          io.stderr(`nightowl ingest-ci: ${printable(errorMessage(error))}\n`);
          return 1;
        }
        const result = ingestCiRecords(store, records);
        io.stdout(
          `Ingested CI signals: ${result.inserted} new, ${result.skipped} duplicate (of ${records.length} failure(s) in file)\n`,
        );
        return 0;
      } finally {
        store.close();
      }
    },
  };
}

export const ingestCiCommand = createIngestCiCommand();

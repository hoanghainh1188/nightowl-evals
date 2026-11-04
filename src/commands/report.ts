import { parseArgs } from 'node:util';
import { errorMessage } from '../cli/errors.js';
import { buildReport } from '../report/build.js';
import { formatJson, formatText } from '../report/format.js';
import { parseDateOption } from '../shared/date-option.js';
import type { Command } from './command.js';
import { openExistingStore } from './existing-store.js';

export const DEFAULT_DEPTH = 2;
const MAX_DEPTH = 5;

export interface ReportDeps {
  readonly cwd: () => string;
  readonly now: () => Date;
}

interface Options {
  readonly json: boolean;
  readonly since: string | null;
  readonly depth: number;
}

function parseOptions(args: readonly string[]): Options | string {
  let values;
  try {
    values = parseArgs({
      args: [...args],
      options: { json: { type: 'boolean' }, since: { type: 'string' }, depth: { type: 'string' } },
      strict: true,
      allowPositionals: false,
    }).values;
  } catch (error) {
    return errorMessage(error);
  }
  const since = values.since === undefined ? null : parseDateOption(values.since);
  if (since === null && values.since !== undefined) return `invalid --since date (use YYYY-MM-DD): ${values.since}`;
  const depth = values.depth === undefined ? DEFAULT_DEPTH : Number(values.depth);
  if (!Number.isInteger(depth) || depth < 1 || depth > MAX_DEPTH) return `--depth must be a whole number from 1 to ${MAX_DEPTH}`;
  return { json: values.json === true, since, depth };
}

export function createReportCommand(deps: ReportDeps = { cwd: () => process.cwd(), now: () => new Date() }): Command {
  return {
    name: 'report',
    summary: 'Summarize recorded failures by type, module and week',
    run: async (args, io) => {
      const options = parseOptions(args);
      if (typeof options === 'string') {
        io.stderr(`nightowl report: ${options}\n`);
        return 1;
      }
      const store = await openExistingStore(deps.cwd());
      if (typeof store === 'string') {
        io.stderr(`nightowl report: ${store}\n`);
        return 1;
      }
      try {
        const report = buildReport({
          failures: store.countFailuresForReport(options.since),
          checks: store.countChecksForReport(options.since),
          depth: options.depth,
          since: options.since,
          generatedAt: deps.now().toISOString(),
        });
        io.stdout(options.json ? formatJson(report) : formatText(report));
        return 0;
      } finally {
        store.close();
      }
    },
  };
}

export const reportCommand = createReportCommand();

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { AGENT_IDS, isAnyAgentId } from '../agents/ids.js';
import { errorMessage } from '../cli/errors.js';
import { renderCommandHelp } from '../cli/help.js';
import { groupFailures } from '../cluster/group.js';
import {
  formatCustomerReport,
  type CustomerFormat,
  type CustomerLangOption,
} from '../customer-report/format.js';
import { buildReport } from '../report/build.js';
import { TOP_CLUSTERS } from '../report/format.js';
import { parseDateOption } from '../shared/date-option.js';
import { SIGNAL_KINDS } from '../storage/events.js';
import type { Command } from './command.js';
import { openExistingStore } from './existing-store.js';

export const DEFAULT_DEPTH = 2;
const MAX_DEPTH = 5;
const LANGS = new Set(['vi', 'ja', 'both']);
const FORMATS = new Set(['md', 'html']);

export interface CustomerReportDeps {
  readonly cwd: () => string;
  readonly now: () => Date;
  readonly writeFile?: (path: string, content: string) => Promise<void>;
}

interface Options {
  readonly lang: CustomerLangOption;
  readonly format: CustomerFormat;
  readonly since: string | null;
  readonly depth: number;
  readonly output: string | null;
  readonly agents: readonly string[] | null;
}

function parseOptions(args: readonly string[]): Options | string {
  let values;
  try {
    values = parseArgs({
      args: [...args],
      options: {
        lang: { type: 'string' },
        format: { type: 'string' },
        since: { type: 'string' },
        depth: { type: 'string' },
        output: { type: 'string', short: 'o' },
        agent: { type: 'string', multiple: true },
      },
      strict: true,
      allowPositionals: false,
    }).values;
  } catch (error) {
    return errorMessage(error);
  }

  const langRaw = values.lang === undefined ? 'both' : values.lang.trim();
  if (!LANGS.has(langRaw)) return `--lang must be one of: vi, ja, both`;
  const lang = langRaw as CustomerLangOption;

  const formatRaw = values.format === undefined ? 'md' : values.format.trim();
  if (!FORMATS.has(formatRaw)) return `--format must be one of: md, html`;
  const format = formatRaw as CustomerFormat;

  const since = values.since === undefined ? null : parseDateOption(values.since);
  if (since === null && values.since !== undefined) return `invalid --since date (use YYYY-MM-DD): ${values.since}`;

  const depth = values.depth === undefined ? DEFAULT_DEPTH : Number(values.depth);
  if (!Number.isInteger(depth) || depth < 1 || depth > MAX_DEPTH) {
    return `--depth must be a whole number from 1 to ${MAX_DEPTH}`;
  }

  const output = values.output === undefined ? null : values.output.trim();
  if (output !== null && output.length === 0) return '--output cannot be empty';

  const agentFlags = values.agent ?? [];
  for (const id of agentFlags) {
    if (!isAnyAgentId(id)) return `unknown --agent id: ${id} (known: ${AGENT_IDS.join(', ')}, unknown)`;
  }
  const agents = agentFlags.length === 0 ? null : agentFlags;

  return { lang, format, since, depth, output, agents };
}

export function createCustomerReportCommand(
  deps: CustomerReportDeps = { cwd: () => process.cwd(), now: () => new Date() },
): Command {
  return {
    name: 'customer-report',
    summary: 'Export bilingual AI quality report for customers (Markdown/HTML)',
    help: renderCommandHelp({
      name: 'customer-report',
      usage: '[options]',
      description: [
        'Exports a customer-facing AI quality report from local NightOwl data.',
        'Default: bilingual Vietnamese–Japanese Markdown. Offline templates; no network.',
        'Does not include developer names or emails. Not a CI gate (use report --fail-on-rate).',
      ],
      options: [
        ['--lang <vi|ja|both>', 'Report language (default: both)'],
        ['--format <md|html>', 'Output format (default: md)'],
        ['--since <YYYY-MM-DD>', 'Only failures from this date on'],
        [`--depth <1-${MAX_DEPTH}>`, `Folder levels that make up a module (default: ${DEFAULT_DEPTH})`],
        ['--agent <id>', 'Only include this agent (repeatable)'],
        ['-o, --output <file>', 'Write report to a file (creates parent directories)'],
      ],
    }),
    run: async (args, io) => {
      const options = parseOptions(args);
      if (typeof options === 'string') {
        io.stderr(`nightowl customer-report: ${options}\n`);
        return 1;
      }
      const store = await openExistingStore(deps.cwd());
      if (typeof store === 'string') {
        io.stderr(`nightowl customer-report: ${store}\n`);
        return 1;
      }
      try {
        const signalCounts = store.countEventsByKind(SIGNAL_KINDS, options.since);
        const clusters = groupFailures(store.listFailuresForClustering(options.since, options.agents), {
          depth: options.depth,
          minCount: 2,
          limit: TOP_CLUSTERS,
          excludeDismissed: true,
        });
        const report = buildReport({
          failures: store.countFailuresForReport(options.since, options.agents),
          checks: store.countChecksForReport(options.since, options.agents),
          depth: options.depth,
          since: options.since,
          generatedAt: deps.now().toISOString(),
          agents: options.agents,
          signals: {
            ciFail: signalCounts['ci-fail'] ?? 0,
            prReview: signalCounts['pr-review'] ?? 0,
            revert: signalCounts['revert'] ?? 0,
          },
          autoNoise: store.countAutoNoiseFailures(options.since),
          clusters,
        });
        const outputContent = formatCustomerReport(report, {
          lang: options.lang,
          format: options.format,
        });
        if (options.output !== null) {
          const write =
            deps.writeFile ??
            (async (file, content) => {
              await mkdir(dirname(file), { recursive: true });
              await writeFile(file, content, 'utf8');
            });
          await write(options.output, outputContent);
          return 0;
        }
        io.stdout(outputContent);
        return 0;
      } finally {
        store.close();
      }
    },
  };
}

export const customerReportCommand = createCustomerReportCommand();

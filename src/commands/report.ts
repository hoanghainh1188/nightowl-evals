import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { AGENT_IDS, isAnyAgentId } from '../agents/ids.js';
import { errorMessage } from '../cli/errors.js';
import { renderCommandHelp } from '../cli/help.js';
import { groupFailures } from '../cluster/group.js';
import { buildReport } from '../report/build.js';
import { formatJson, formatText, TOP_CLUSTERS } from '../report/format.js';
import { parseDateOption } from '../shared/date-option.js';
import { SIGNAL_KINDS } from '../storage/events.js';
import type { Command } from './command.js';
import { openExistingStore } from './existing-store.js';

export const DEFAULT_DEPTH = 2;
const MAX_DEPTH = 5;

export interface ReportDeps {
  readonly cwd: () => string;
  readonly now: () => Date;
  readonly writeFile?: (path: string, content: string) => Promise<void>;
}

interface Options {
  readonly json: boolean;
  readonly since: string | null;
  readonly depth: number;
  readonly output: string | null;
  readonly failOnRate: number | null;
  readonly agents: readonly string[] | null;
}

function parseOptions(args: readonly string[]): Options | string {
  let values;
  try {
    values = parseArgs({
      args: [...args],
      options: {
        json: { type: 'boolean' },
        since: { type: 'string' },
        depth: { type: 'string' },
        output: { type: 'string', short: 'o' },
        'fail-on-rate': { type: 'string' },
        agent: { type: 'string', multiple: true },
      },
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

  let failOnRate: number | null = null;
  if (values['fail-on-rate'] !== undefined) {
    const rate = Number(values['fail-on-rate']);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      return '--fail-on-rate must be a number from 0 to 100';
    }
    failOnRate = rate;
  }

  const output = values.output === undefined ? null : values.output.trim();
  if (output !== null && output.length === 0) {
    return '--output cannot be empty';
  }

  const agentFlags = values.agent ?? [];
  for (const id of agentFlags) {
    if (!isAnyAgentId(id)) return `unknown --agent id: ${id} (known: ${AGENT_IDS.join(', ')}, unknown)`;
  }
  const agents = agentFlags.length === 0 ? null : agentFlags;

  return { json: values.json === true, since, depth, output, failOnRate, agents };
}

export function createReportCommand(deps: ReportDeps = { cwd: () => process.cwd(), now: () => new Date() }): Command {
  return {
    name: 'report',
    summary: 'Summarize recorded failures by type, module and week',
    help: renderCommandHelp({
      name: 'report',
      usage: '[options]',
      description: [
        'Summarizes recorded failures by type, module, agent and ISO week. Reads only; changes nothing.',
        'Includes by_agent and head_to_head comparison of edit-change rates per agent.',
      ],
      options: [
        ['--since <YYYY-MM-DD>', 'Only failures from this date on'],
        [`--depth <1-${MAX_DEPTH}>`, `Folder levels that make up a module (default: ${DEFAULT_DEPTH})`],
        ['--agent <id>', 'Only include this agent (repeatable)'],
        ['--json', 'Print the same data as JSON'],
        ['-o, --output <file>', 'Write report output to a file'],
        ['--fail-on-rate <0-100>', 'Exit with code 1 if changed rate exceeds threshold (CI gate)'],
      ],
    }),
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
        const outputContent = options.json ? formatJson(report) : formatText(report);
        if (options.output !== null) {
          const write =
            deps.writeFile ??
            (async (file, content) => {
              await mkdir(dirname(file), { recursive: true });
              await writeFile(file, content, 'utf8');
            });
          await write(options.output, outputContent);
        }
        io.stdout(outputContent);

        if (options.failOnRate !== null && report.changedRate.checked > 0 && report.changedRate.rate !== null) {
          const actualPercent = report.changedRate.rate * 100;
          if (actualPercent > options.failOnRate) {
            io.stderr(`nightowl report: failure rate (${Math.round(actualPercent)}%) exceeds threshold of ${options.failOnRate}%\n`);
            return 1;
          }
        }

        return 0;
      } finally {
        store.close();
      }
    },
  };
}

export const reportCommand = createReportCommand();

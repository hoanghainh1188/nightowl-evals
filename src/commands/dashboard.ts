import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { AGENT_IDS, isAnyAgentId } from '../agents/ids.js';
import { errorMessage } from '../cli/errors.js';
import { renderCommandHelp } from '../cli/help.js';
import { groupFailures } from '../cluster/group.js';
import { formatDashboardHtml } from '../dashboard/format.js';
import { openLocalPath } from '../dashboard/open-local.js';
import { redactPathsInReport } from '../privacy/index.js';
import { buildReport } from '../report/build.js';
import { TOP_CLUSTERS } from '../report/format.js';
import { parseDateOption } from '../shared/date-option.js';
import { SIGNAL_KINDS } from '../storage/events.js';
import { applyWorkspaceFilter, prepareWorkspaces } from '../workspace/for-report.js';
import type { Command } from './command.js';
import { openExistingStore } from './existing-store.js';

export const DEFAULT_DEPTH = 2;
const MAX_DEPTH = 5;
export const DEFAULT_DASHBOARD_RELATIVE = join('.nightowl', 'dashboard.html');

export interface DashboardDeps {
  readonly cwd: () => string;
  readonly now: () => Date;
  readonly writeFile?: (path: string, content: string) => Promise<void>;
  readonly openPath?: (absolutePath: string) => void;
}

interface Options {
  readonly since: string | null;
  readonly depth: number;
  readonly output: string | null;
  readonly open: boolean;
  readonly agents: readonly string[] | null;
  readonly redactPaths: boolean;
  readonly workspaces: readonly string[];
}

function parseOptions(args: readonly string[]): Options | string {
  let values;
  try {
    values = parseArgs({
      args: [...args],
      options: {
        since: { type: 'string' },
        depth: { type: 'string' },
        output: { type: 'string', short: 'o' },
        open: { type: 'boolean', default: false },
        agent: { type: 'string', multiple: true },
        'redact-paths': { type: 'boolean' },
        workspace: { type: 'string', multiple: true },
      },
      strict: true,
      allowPositionals: false,
    }).values;
  } catch (error) {
    return errorMessage(error);
  }

  const since = values.since === undefined ? null : parseDateOption(values.since);
  if (since === null && values.since !== undefined) {
    return `invalid --since date (use YYYY-MM-DD): ${values.since}`;
  }

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

  return {
    since,
    depth,
    output,
    open: values.open === true,
    agents,
    redactPaths: values['redact-paths'] === true,
    workspaces: values.workspace ?? [],
  };
}

export function createDashboardCommand(deps: DashboardDeps = { cwd: () => process.cwd(), now: () => new Date() }): Command {
  return {
    name: 'dashboard',
    summary: 'Write a local-only HTML dashboard from NightOwl data',
    help: renderCommandHelp({
      name: 'dashboard',
      usage: '[options]',
      description: [
        'Writes a self-contained HTML dashboard from local NightOwl SQLite data.',
        'Local-only: no network, no SaaS team dashboard, no developer names.',
        'Default output: .nightowl/dashboard.html. Use --open to open via the OS file handler.',
        'Not a CI gate (use report --fail-on-rate).',
      ],
      options: [
        ['--since <YYYY-MM-DD>', 'Only failures from this date on'],
        [`--depth <1-${MAX_DEPTH}>`, `Folder levels that make up a module when outside a package (default: ${DEFAULT_DEPTH})`],
        ['--workspace <name|path>', 'Only failures in this package/workspace (repeatable; name or path)'],
        ['--agent <id>', 'Only include this agent (repeatable)'],
        ['-o, --output <file>', `Write HTML to this path (default: ${DEFAULT_DASHBOARD_RELATIVE})`],
        ['--open', 'Open the HTML file with the OS default browser (file://, no HTTP server)'],
        ['--redact-paths', 'Coarsen module/path labels in the HTML (share-out)'],
      ],
    }),
    run: async (args, io) => {
      const options = parseOptions(args);
      if (typeof options === 'string') {
        io.stderr(`nightowl dashboard: ${options}\n`);
        return 1;
      }
      const cwd = deps.cwd();
      const store = await openExistingStore(cwd);
      if (typeof store === 'string') {
        io.stderr(`nightowl dashboard: ${store}\n`);
        return 1;
      }
      const relativeOut = options.output ?? DEFAULT_DASHBOARD_RELATIVE;
      const absoluteOut = resolve(cwd, relativeOut);
      try {
        const ws = await prepareWorkspaces(store.root, options.workspaces);
        if (typeof ws === 'string') {
          io.stderr(`nightowl dashboard: ${ws}\n`);
          return 1;
        }
        const signalCounts = store.countEventsByKind(SIGNAL_KINDS, options.since);
        const clustered = applyWorkspaceFilter(
          store.listFailuresForClustering(options.since, options.agents),
          ws.filter,
          ws.all,
        );
        const clusters = groupFailures(clustered, {
          depth: options.depth,
          minCount: 2,
          limit: TOP_CLUSTERS,
          excludeDismissed: true,
          workspaces: ws.all,
        });
        const built = buildReport({
          failures: applyWorkspaceFilter(
            store.countFailuresForReport(options.since, options.agents),
            ws.filter,
            ws.all,
          ),
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
          workspaces: ws.all,
        });
        const report = options.redactPaths ? redactPathsInReport(built) : built;
        const html = formatDashboardHtml(report);
        const write =
          deps.writeFile ??
          (async (file, content) => {
            await mkdir(dirname(file), { recursive: true });
            await writeFile(file, content, 'utf8');
          });
        await write(absoluteOut, html);
        io.stdout(`${absoluteOut}\n`);
        if (options.open) {
          try {
            const open = deps.openPath ?? ((path) => openLocalPath(path));
            open(absoluteOut);
          } catch (error) {
            io.stderr(`nightowl dashboard: failed to open ${absoluteOut}: ${errorMessage(error)}\n`);
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

export const dashboardCommand = createDashboardCommand();

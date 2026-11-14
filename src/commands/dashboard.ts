import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { AGENT_IDS, isAnyAgentId } from '../agents/ids.js';
import { errorMessage } from '../cli/errors.js';
import { renderCommandHelp } from '../cli/help.js';
import { groupFailures } from '../cluster/group.js';
import {
  loadConfigFromCwd,
  pickAgents,
  pickRedactPaths,
  pickWorkspaces,
  PROJECT_CONFIG_FILE,
} from '../config/index.js';
import { formatDashboardHtml } from '../dashboard/format.js';
import { openLocalPath } from '../dashboard/open-local.js';
import { resolveRuleImpactSummary } from '../impact/summary.js';
import { redactPathsInReport } from '../privacy/index.js';
import { buildReport } from '../report/build.js';
import { computeRepeatFromStore } from '../report/compute-repeat.js';
import { TOP_CLUSTERS } from '../report/format.js';
import { parseDateOption } from '../shared/date-option.js';
import { SIGNAL_KINDS } from '../storage/events.js';
import { applyWorkspaceFilter, prepareWorkspaces, scopeChecksForWorkspace } from '../workspace/for-report.js';
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
  readonly redactPathsExplicit: boolean | undefined;
  readonly workspaces: readonly string[];
  readonly configPath?: string;
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
        config: { type: 'string' },
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
  const configPath = values.config;

  return {
    since,
    depth,
    output,
    open: values.open === true,
    agents,
    redactPathsExplicit: values['redact-paths'] === undefined ? undefined : values['redact-paths'] === true,
    workspaces: values.workspace ?? [],
    ...(configPath === undefined ? {} : { configPath }),
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
        'Includes repeat outcomes and a rule-impact line when a rule was marked (same semantics as digest).',
        'Not a CI gate (use report --fail-on-rate).',
        `privacy.redactPaths from ${PROJECT_CONFIG_FILE} applies when --redact-paths is omitted.`,
      ],
      options: [
        ['--since <YYYY-MM-DD>', 'Only failures from this date on'],
        [`--depth <1-${MAX_DEPTH}>`, `Folder levels that make up a module when outside a package (default: ${DEFAULT_DEPTH})`],
        ['--workspace <name|path>', 'Only failures in this package/workspace (repeatable; name or path)'],
        ['--agent <id>', 'Only include this agent (repeatable)'],
        ['-o, --output <file>', `Write HTML to this path (default: ${DEFAULT_DASHBOARD_RELATIVE})`],
        ['--open', 'Open the HTML file with the OS default browser (file://, no HTTP server)'],
        ['--redact-paths', 'Coarsen module/path labels in the HTML (share-out)'],
        ['--config <path>', `Override project config file (default: ${PROJECT_CONFIG_FILE})`],
      ],
    }),
    run: async (args, io) => {
      const options = parseOptions(args);
      if (typeof options === 'string') {
        io.stderr(`nightowl dashboard: ${options}\n`);
        return 1;
      }
      const cwd = deps.cwd();
      const loaded = await loadConfigFromCwd({
        cwd,
        ...(options.configPath === undefined ? {} : { configPath: options.configPath }),
      });
      if (!loaded.ok) {
        io.stderr(`nightowl dashboard: ${loaded.error}\n`);
        return 1;
      }
      const agents = pickAgents(options.agents, loaded.config);
      const workspaces = pickWorkspaces(options.workspaces, loaded.config);
      const redactPaths = pickRedactPaths(options.redactPathsExplicit, loaded.config, false);
      const store = await openExistingStore(cwd);
      if (typeof store === 'string') {
        io.stderr(`nightowl dashboard: ${store}\n`);
        return 1;
      }
      const relativeOut = options.output ?? DEFAULT_DASHBOARD_RELATIVE;
      const absoluteOut = resolve(cwd, relativeOut);
      try {
        const ws = await prepareWorkspaces(store.root, workspaces);
        if (typeof ws === 'string') {
          io.stderr(`nightowl dashboard: ${ws}\n`);
          return 1;
        }
        const signalCounts = store.countEventsByKind(SIGNAL_KINDS, options.since);
        const clustered = applyWorkspaceFilter(
          store.listFailuresForClustering(options.since, agents),
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
        const checkScope = scopeChecksForWorkspace(
          store.countChecksForReport(options.since, agents),
          ws.filter,
          ws.all,
        );
        const repeat = computeRepeatFromStore({
          store,
          since: options.since,
          agents: agents,
          depth: options.depth,
          workspaces: ws.all,
          workspaceFilter: ws.filter,
          now: deps.now(),
        });
        if ('error' in repeat) {
          io.stderr(`nightowl dashboard: ${repeat.error}\n`);
          return 1;
        }
        const built = buildReport({
          failures: applyWorkspaceFilter(
            store.countFailuresForReport(options.since, agents),
            ws.filter,
            ws.all,
          ),
          checks: checkScope.scoped,
          depth: options.depth,
          since: options.since,
          generatedAt: deps.now().toISOString(),
          agents: agents,
          signals: {
            ciFail: signalCounts['ci-fail'] ?? 0,
            prReview: signalCounts['pr-review'] ?? 0,
            revert: signalCounts['revert'] ?? 0,
          },
          autoNoise: store.countAutoNoiseFailures(options.since),
          clusters,
          repeat,
          workspaces: ws.all,
        });
        const report = redactPaths ? redactPathsInReport(built) : built;
        const generatedAt = report.generatedAt;
        const ruleImpact = resolveRuleImpactSummary(store, generatedAt);
        const html = formatDashboardHtml(report, ruleImpact);
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

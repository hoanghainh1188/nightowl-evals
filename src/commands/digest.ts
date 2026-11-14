import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { AGENT_IDS, isAnyAgentId } from '../agents/ids.js';
import { errorMessage } from '../cli/errors.js';
import { renderCommandHelp } from '../cli/help.js';
import {
  loadConfigFromCwd,
  pickAgents,
  pickDigestLookbackDays,
  pickRedactPaths,
  pickWorkspaces,
  PROJECT_CONFIG_FILE,
} from '../config/index.js';
import { buildDigest, loadEvalLoopForDigest } from '../digest/build.js';
import { formatDigestHtml, formatDigestMarkdown } from '../digest/format.js';
import { DEFAULT_DIGEST_LOOKBACK_DAYS, parseDigestSince, sinceDaysAgo } from '../digest/since.js';
import { printable } from '../shared/printable.js';
import { prepareWorkspaces } from '../workspace/for-report.js';
import type { Command } from './command.js';
import { openExistingStore } from './existing-store.js';

export const DEFAULT_DEPTH = 2;
const MAX_DEPTH = 5;
export const DEFAULT_DIGEST_RELATIVE = join('.nightowl', 'digest.html');

export interface DigestDeps {
  readonly cwd: () => string;
  readonly now: () => Date;
  readonly writeFile?: (path: string, content: string) => Promise<void>;
}

interface Options {
  readonly sinceRaw: string | undefined;
  readonly depth: number;
  readonly format: 'md' | 'html';
  readonly output: string | null;
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
        format: { type: 'string' },
        output: { type: 'string', short: 'o' },
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

  const depth = values.depth === undefined ? DEFAULT_DEPTH : Number(values.depth);
  if (!Number.isInteger(depth) || depth < 1 || depth > MAX_DEPTH) {
    return `--depth must be a whole number from 1 to ${MAX_DEPTH}`;
  }

  const formatRaw = values.format ?? 'md';
  if (formatRaw !== 'md' && formatRaw !== 'html') return `--format must be md or html (got: ${formatRaw})`;

  const output = values.output === undefined ? null : values.output.trim();
  if (output !== null && output.length === 0) return '--output cannot be empty';

  const agentFlags = values.agent ?? [];
  for (const id of agentFlags) {
    if (!isAnyAgentId(id)) return `unknown --agent id: ${id} (known: ${AGENT_IDS.join(', ')}, unknown)`;
  }
  const agents = agentFlags.length === 0 ? null : agentFlags;
  const configPath = values.config;

  return {
    sinceRaw: values.since,
    depth,
    format: formatRaw,
    output,
    agents,
    redactPathsExplicit: values['redact-paths'] === undefined ? undefined : values['redact-paths'] === true,
    workspaces: values.workspace ?? [],
    ...(configPath === undefined ? {} : { configPath }),
  };
}

export function createDigestCommand(deps: DigestDeps = { cwd: () => process.cwd(), now: () => new Date() }): Command {
  return {
    name: 'digest',
    summary: 'Write a local standup/weekly digest from NightOwl data',
    help: renderCommandHelp({
      name: 'digest',
      usage: '[options]',
      description: [
        'Summarizes recent NightOwl failures for standup/weekly: totals, top categories/agents,',
        'open (flagged) reviews, signals, repeat outcomes (cluster keys vs prior baseline window),',
        'a short rule-impact line when a rule was marked, and a local eval-loop line from .nightowl/runs/.',
        'Local-only: does not email or Slack, does not call the network, does not show developer names.',
        `Default window: last ${DEFAULT_DIGEST_LOOKBACK_DAYS} days (UTC), or digest.lookbackDays from ${PROJECT_CONFIG_FILE}.`,
        'Markdown prints to stdout; HTML writes a file. CLI flags override config (local-only, no cloud sync).',
      ],
      options: [
        ['--since <YYYY-MM-DD|Nd>', `Window start (default: ${DEFAULT_DIGEST_LOOKBACK_DAYS}d or config; e.g. 7d)`],
        [`--depth <1-${MAX_DEPTH}>`, `Module folder depth when outside a package (default: ${DEFAULT_DEPTH})`],
        ['--workspace <name|path>', 'Only failures in this package/workspace (repeatable; name or path)'],
        ['--agent <id>', 'Only include this agent (repeatable)'],
        ['--format md|html', 'Output format (default: md)'],
        ['-o, --output <file>', `Write output to a file (html default: ${DEFAULT_DIGEST_RELATIVE})`],
        ['--redact-paths', 'Accepted for share-out consistency (no-op when digest has no paths)'],
        ['--config <path>', `Override project config file (default: ${PROJECT_CONFIG_FILE})`],
      ],
    }),
    run: async (args, io) => {
      const options = parseOptions(args);
      if (typeof options === 'string') {
        io.stderr(`nightowl digest: ${options}\n`);
        return 1;
      }
      const loaded = await loadConfigFromCwd({
        cwd: deps.cwd(),
        ...(options.configPath === undefined ? {} : { configPath: options.configPath }),
      });
      if (!loaded.ok) {
        io.stderr(`nightowl digest: ${loaded.error}\n`);
        return 1;
      }
      const lookback = pickDigestLookbackDays(options.sinceRaw !== undefined, loaded.config);
      const sinceParsed =
        options.sinceRaw === undefined && lookback !== undefined
          ? { since: sinceDaysAgo(deps.now(), lookback) }
          : parseDigestSince(options.sinceRaw, deps.now());
      if ('error' in sinceParsed) {
        io.stderr(`nightowl digest: ${sinceParsed.error}\n`);
        return 1;
      }
      const agents = pickAgents(options.agents, loaded.config);
      const workspaces = pickWorkspaces(options.workspaces, loaded.config);
      // Apply config default for --redact-paths (digest currently treats the flag as a no-op).
      const _redactPaths = pickRedactPaths(options.redactPathsExplicit, loaded.config, false);
      void _redactPaths;
      const store = await openExistingStore(deps.cwd());
      if (typeof store === 'string') {
        io.stderr(`nightowl digest: ${store}\n`);
        return 1;
      }
      try {
        const ws = await prepareWorkspaces(store.root, workspaces);
        if (typeof ws === 'string') {
          io.stderr(`nightowl digest: ${ws}\n`);
          return 1;
        }
        const generatedAt = deps.now().toISOString();
        const evalLoop = await loadEvalLoopForDigest(store.root);
        const digest = buildDigest({
          store,
          since: sinceParsed.since,
          depth: options.depth,
          agents,
          generatedAt,
          nowIso: generatedAt,
          workspaces: ws.all,
          workspaceFilter: ws.filter,
          evalLoop,
        });
        const content =
          options.format === 'html' ? formatDigestHtml(digest) : formatDigestMarkdown(digest);

        if (options.format === 'html') {
          const relative = options.output ?? DEFAULT_DIGEST_RELATIVE;
          const absolute = resolve(store.root, relative);
          const write =
            deps.writeFile ??
            (async (file, body) => {
              await mkdir(dirname(file), { recursive: true });
              await writeFile(file, body, 'utf8');
            });
          try {
            await write(absolute, content);
          } catch (error) {
            io.stderr(`nightowl digest: cannot write ${printable(absolute)}: ${printable(errorMessage(error))}\n`);
            return 1;
          }
          io.stdout(`Wrote digest to ${absolute}\n`);
          return 0;
        }

        if (options.output !== null) {
          const absolute = resolve(store.root, options.output);
          const write =
            deps.writeFile ??
            (async (file, body) => {
              await mkdir(dirname(file), { recursive: true });
              await writeFile(file, body, 'utf8');
            });
          try {
            await write(absolute, content);
          } catch (error) {
            io.stderr(`nightowl digest: cannot write ${printable(absolute)}: ${printable(errorMessage(error))}\n`);
            return 1;
          }
        }
        io.stdout(content);
        return 0;
      } finally {
        store.close();
      }
    },
  };
}

export const digestCommand = createDigestCommand();

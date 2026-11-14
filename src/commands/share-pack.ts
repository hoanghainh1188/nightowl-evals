import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import pkg from '../../package.json' with { type: 'json' };
import { AGENT_IDS, isAnyAgentId } from '../agents/ids.js';
import { errorMessage } from '../cli/errors.js';
import { renderCommandHelp } from '../cli/help.js';
import type { Io } from '../cli/io.js';
import { loadConfigFromCwd, pickAgents, pickRedactPaths, PROJECT_CONFIG_FILE } from '../config/index.js';
import { buildDigest, loadEvalLoopForDigest } from '../digest/build.js';
import { formatDigestMarkdown } from '../digest/format.js';
import { DEFAULT_DIGEST_LOOKBACK_DAYS, parseDigestSince } from '../digest/since.js';
import { redactPathsInReport } from '../privacy/index.js';
import { buildReport } from '../report/build.js';
import { formatText } from '../report/format.js';
import {
  buildSharePackManifest,
  PACK_DIGEST_FILE,
  PACK_MANIFEST_FILE,
  PACK_REPORT_FILE,
  stampFromIso,
} from '../share/pack.js';
import { writeTarGz } from '../share/tar-gz.js';
import { printable } from '../shared/printable.js';
import { SIGNAL_KINDS } from '../storage/events.js';
import { DATA_DIR, type Store } from '../storage/store.js';
import type { Command } from './command.js';
import { openExistingStore } from './existing-store.js';

export const DEFAULT_DEPTH = 2;
const MAX_DEPTH = 5;

export interface SharePackDeps {
  readonly cwd: () => string;
  readonly now: () => Date;
  readonly writeFile?: (path: string, content: string) => Promise<void>;
  readonly writeArchive?: (path: string, files: readonly { name: string; content: string }[]) => Promise<void>;
}

interface Options {
  readonly since: string;
  readonly depth: number;
  readonly agents: readonly string[] | null;
  /** undefined = flag omitted; false = --no-redact-paths; true would mean forced on (not a CLI flag). */
  readonly noRedactPathsExplicit: boolean;
  readonly output: string | null;
  readonly archive: boolean;
  readonly configPath?: string;
}

function parseOptions(args: readonly string[], now: Date): Options | string {
  let values;
  try {
    values = parseArgs({
      args: [...args],
      options: {
        since: { type: 'string' },
        depth: { type: 'string' },
        agent: { type: 'string', multiple: true },
        'no-redact-paths': { type: 'boolean' },
        output: { type: 'string', short: 'o' },
        archive: { type: 'boolean' },
        config: { type: 'string' },
      },
      strict: true,
      allowPositionals: false,
    }).values;
  } catch (error) {
    return errorMessage(error);
  }

  const sinceParsed = parseDigestSince(values.since, now);
  if ('error' in sinceParsed) return sinceParsed.error;

  const depth = values.depth === undefined ? DEFAULT_DEPTH : Number(values.depth);
  if (!Number.isInteger(depth) || depth < 1 || depth > MAX_DEPTH) {
    return `--depth must be a whole number from 1 to ${MAX_DEPTH}`;
  }

  const agentFlags = values.agent ?? [];
  for (const id of agentFlags) {
    if (!isAnyAgentId(id)) return `unknown --agent id: ${id} (known: ${AGENT_IDS.join(', ')}, unknown)`;
  }

  const output = values.output === undefined ? null : values.output.trim();
  if (output !== null && output.length === 0) return '--output cannot be empty';
  const configPath = values.config;

  return {
    since: sinceParsed.since,
    depth,
    agents: agentFlags.length === 0 ? null : agentFlags,
    noRedactPathsExplicit: values['no-redact-paths'] === true,
    output,
    archive: values.archive === true,
    ...(configPath === undefined ? {} : { configPath }),
  };
}

function defaultPackDir(root: string, generatedAt: string): string {
  return join(root, DATA_DIR, 'share', stampFromIso(generatedAt));
}

function buildReportForPack(
  store: Store,
  options: Options,
  generatedAt: string,
  agents: readonly string[] | null,
  redactPaths: boolean,
) {
  const signalCounts = store.countEventsByKind(SIGNAL_KINDS, options.since);
  const report = buildReport({
    failures: store.countFailuresForReport(options.since, agents),
    checks: store.countChecksForReport(options.since, agents),
    depth: options.depth,
    since: options.since,
    generatedAt,
    agents,
    signals: {
      ciFail: signalCounts['ci-fail'] ?? 0,
      prReview: signalCounts['pr-review'] ?? 0,
      revert: signalCounts['revert'] ?? 0,
    },
    autoNoise: store.countAutoNoiseFailures(options.since),
    clusters: [],
  });
  return redactPaths ? redactPathsInReport(report) : report;
}

export function createSharePackCommand(deps: SharePackDeps = { cwd: () => process.cwd(), now: () => new Date() }): Command {
  const writeText =
    deps.writeFile ??
    (async (file: string, content: string) => {
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, content, 'utf8');
    });
  const writeArchive = deps.writeArchive ?? writeTarGz;

  return {
    name: 'share-pack',
    summary: 'Build a local offline share pack (report + digest + privacy manifest)',
    help: renderCommandHelp({
      name: 'share-pack',
      usage: '[options]',
      description: [
        'Writes a local share-out pack: report.md, digest.md, and manifest.json.',
        'Path redaction is on by default (share-safe); privacy.redactPaths in config can change the default.',
        '--no-redact-paths always wins. Does not call the network or include developer names.',
        'Optional --archive writes a .tar.gz beside the pack directory (Node zlib; not zip).',
      ],
      options: [
        [
          `--since <YYYY-MM-DD|Nd>`,
          `Window start (default: last ${DEFAULT_DIGEST_LOOKBACK_DAYS} days UTC; e.g. 7d)`,
        ],
        [`--depth <1-${MAX_DEPTH}>`, `Module folder depth (default: ${DEFAULT_DEPTH})`],
        ['--agent <id>', 'Only include this agent (repeatable)'],
        ['--no-redact-paths', 'Keep full module/path labels (default: paths are coarsened)'],
        ['-o, --output <dir>', `Pack directory (default: ${DATA_DIR}/share/<stamp>/)`],
        ['--archive', 'Also write <dir>.tar.gz locally (no upload)'],
        ['--config <path>', `Override project config file (default: ${PROJECT_CONFIG_FILE})`],
      ],
    }),
    run: async (args, io) => {
      const options = parseOptions(args, deps.now());
      if (typeof options === 'string') {
        io.stderr(`nightowl share-pack: ${options}\n`);
        return 1;
      }

      const loaded = await loadConfigFromCwd({
        cwd: deps.cwd(),
        ...(options.configPath === undefined ? {} : { configPath: options.configPath }),
      });
      if (!loaded.ok) {
        io.stderr(`nightowl share-pack: ${loaded.error}\n`);
        return 1;
      }
      const agents = pickAgents(options.agents, loaded.config);
      const redactPaths = pickRedactPaths(
        options.noRedactPathsExplicit ? false : undefined,
        loaded.config,
        true,
      );

      const store = await openExistingStore(deps.cwd());
      if (typeof store === 'string') {
        io.stderr(`nightowl share-pack: ${store}\n`);
        return 1;
      }

      try {
        const generatedAt = deps.now().toISOString();
        const packDir =
          options.output === null
            ? defaultPackDir(store.root, generatedAt)
            : resolve(deps.cwd(), options.output);

        const report = buildReportForPack(store, options, generatedAt, agents, redactPaths);
        const reportMd = formatText(report);
        const evalLoop = await loadEvalLoopForDigest(store.root);
        const digest = buildDigest({
          store,
          since: options.since,
          depth: options.depth,
          agents,
          generatedAt,
          evalLoop,
        });
        const digestMd = formatDigestMarkdown(digest);
        const manifest = buildSharePackManifest({
          generatedAt,
          since: options.since,
          redactPaths,
          nightowlVersion: typeof pkg.version === 'string' ? pkg.version : undefined,
        });
        const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;

        await writeText(join(packDir, PACK_REPORT_FILE), reportMd);
        await writeText(join(packDir, PACK_DIGEST_FILE), digestMd);
        await writeText(join(packDir, PACK_MANIFEST_FILE), manifestJson);

        let archivePath: string | null = null;
        if (options.archive) {
          archivePath = `${packDir.replace(/[/\\]+$/, '')}.tar.gz`;
          await writeArchive(archivePath, [
            { name: PACK_REPORT_FILE, content: reportMd },
            { name: PACK_DIGEST_FILE, content: digestMd },
            { name: PACK_MANIFEST_FILE, content: manifestJson },
          ]);
        }

        io.stdout(`Share pack written to ${printable(packDir)}\n`);
        if (archivePath !== null) io.stdout(`Archive written to ${printable(archivePath)}\n`);
        return 0;
      } finally {
        store.close();
      }
    },
  };
}

export const sharePackCommand = createSharePackCommand();

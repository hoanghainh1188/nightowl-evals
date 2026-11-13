import { existsSync, constants as fsConstants } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { AGENT_IDS, maturityOf } from '../agents/ids.js';
import { errorMessage } from '../cli/errors.js';
import { renderCommandHelp } from '../cli/help.js';
import type { Io } from '../cli/io.js';
import { runGit } from '../hooks/git/run-git.js';
import {
  AGENT_CONFIGS,
  hasCompleteBestEffortShape,
  hasNightowlAgentMarker,
  LEGACY_AGENT_CONFIGS,
} from '../setup/agent-config.js';
import {
  hasNightowlHooks,
  PERSONAL_SETTINGS,
  readSettings,
  SHARED_SETTINGS,
} from '../setup/claude-settings.js';
import { hasCursorNightowlHooks } from '../setup/cursor-hooks.js';
import { readTextIfExists } from '../setup/fs-utils.js';
import { GIT_HOOKS } from '../setup/git-hook.js';
import { NIGHTOWL_IGNORE } from '../setup/gitignore.js';
import { detectHookManager } from '../setup/hook-manager.js';
import { isOnPath } from '../setup/path.js';
import { printable } from '../shared/printable.js';
import { SIGNAL_KINDS } from '../storage/events.js';
import { sinceDaysAgo } from '../digest/since.js';
import { CURRENT_SCHEMA_VERSION } from '../storage/migrations.js';
import { findProjectRoot } from '../storage/project-root.js';
import { loadSqlite } from '../storage/sqlite.js';
import { DATA_DIR, DB_FILE, openStore, type Store } from '../storage/store.js';
import {
  DOCTOR_REPORT_SAMPLE_DAYS,
  measureSync,
  REPORT_QUERY_BUDGET_MS,
  type Timed,
} from '../storage/timing.js';
import { discoverWorkspaces, hasWorkspaceConfig } from '../workspace/index.js';
import type { Command } from './command.js';

async function defaultIsExecutable(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.X_OK);
    return true;
  } catch {
    try {
      const mode = (await stat(path)).mode;
      return (mode & 0o111) !== 0;
    } catch {
      return false;
    }
  }
}

export type CheckStatus = 'ok' | 'warn' | 'fail';

export interface DoctorCheck {
  readonly category: string;
  readonly name: string;
  readonly status: CheckStatus;
  readonly message: string;
  readonly remedy?: string;
}

export interface DoctorDeps {
  readonly cwd: () => string;
  readonly nodeVersion: () => string;
  readonly isOnPath: (command: string) => boolean;
  readonly loadSqlite: () => Promise<unknown>;
  readonly runGit: (args: readonly string[], options: { readonly cwd: string }) => Promise<Buffer>;
  readonly findProjectRoot: (cwd: string) => string | null;
  readonly readSettings: typeof readSettings;
  readonly readTextIfExists: typeof readTextIfExists;
  readonly openStore: (options: { cwd?: string; readOnly?: boolean }) => Promise<Store>;
  /** Defaults to process.platform; used to skip execute-bit checks on win32. */
  readonly platform?: () => NodeJS.Platform;
  readonly isExecutable?: (path: string) => Promise<boolean>;
  /** Optional clock for report-query timing (tests). */
  readonly now?: () => Date;
  readonly measureSync?: <T>(fn: () => T) => Timed<T>;
  readonly reportQueryBudgetMs?: number;
}

export const defaultDoctorDeps: DoctorDeps = {
  cwd: () => process.cwd(),
  nodeVersion: () => process.versions.node,
  isOnPath: (cmd) => isOnPath(cmd, process.env.PATH),
  loadSqlite,
  runGit,
  findProjectRoot,
  readSettings,
  readTextIfExists,
  openStore,
  platform: () => process.platform,
  isExecutable: defaultIsExecutable,
};

function parseSemver(version: string): { major: number; minor: number; patch: number } | null {
  const match = version.match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

export async function checkRuntime(deps: DoctorDeps): Promise<readonly DoctorCheck[]> {
  const checks: DoctorCheck[] = [];
  const versionStr = deps.nodeVersion();
  const parsed = parseSemver(versionStr);

  if (!parsed || parsed.major < 22 || (parsed.major === 22 && parsed.minor < 13)) {
    checks.push({
      category: 'Node.js & Runtime',
      name: 'Node.js version',
      status: 'fail',
      message: `Node.js v${versionStr} is unsupported (>= 22.13.0 required)`,
      remedy: 'Upgrade Node.js to version 22.13.0 or higher.',
    });
  } else {
    checks.push({
      category: 'Node.js & Runtime',
      name: 'Node.js version',
      status: 'ok',
      message: `Node.js v${versionStr} (>= 22.13.0)`,
    });
  }

  try {
    await deps.loadSqlite();
    checks.push({
      category: 'Node.js & Runtime',
      name: 'SQLite built-in',
      status: 'ok',
      message: 'node:sqlite is operational',
    });
  } catch (error) {
    checks.push({
      category: 'Node.js & Runtime',
      name: 'SQLite built-in',
      status: 'fail',
      message: `node:sqlite failed to load (${errorMessage(error)})`,
      remedy: 'Ensure Node.js is installed with SQLite support enabled.',
    });
  }

  if (deps.isOnPath('nightowl')) {
    checks.push({
      category: 'Node.js & Runtime',
      name: 'nightowl CLI on PATH',
      status: 'ok',
      message: 'nightowl command is available on PATH',
    });
  } else {
    checks.push({
      category: 'Node.js & Runtime',
      name: 'nightowl CLI on PATH',
      status: 'warn',
      message: 'nightowl command is not on PATH',
      remedy: 'Add nightowl to PATH (npm install -g @hoanghainh/nightowl-evals or add node_modules/.bin to PATH).',
    });
  }

  return checks;
}

export async function checkGit(deps: DoctorDeps, cwd: string): Promise<{ checks: readonly DoctorCheck[]; root: string | null }> {
  const checks: DoctorCheck[] = [];

  try {
    const gitOut = (await deps.runGit(['--version'], { cwd })).toString('utf8').trim();
    checks.push({
      category: 'Git Repository',
      name: 'Git binary',
      status: 'ok',
      message: `${gitOut}`,
    });
  } catch (error) {
    checks.push({
      category: 'Git Repository',
      name: 'Git binary',
      status: 'fail',
      message: `Git is not accessible (${errorMessage(error)})`,
      remedy: 'Install Git and ensure it is available on your PATH.',
    });
  }

  const root = deps.findProjectRoot(cwd);
  if (root) {
    checks.push({
      category: 'Git Repository',
      name: 'Repository root',
      status: 'ok',
      message: `Git repository found at ${root}`,
    });
  } else {
    checks.push({
      category: 'Git Repository',
      name: 'Repository root',
      status: 'fail',
      message: `No git repository found at or above ${cwd}`,
      remedy: "Run nightowl doctor inside a git repository or initialize one with 'git init'.",
    });
  }

  return { checks, root };
}

export async function checkClaude(deps: DoctorDeps, root: string | null): Promise<readonly DoctorCheck[]> {
  const checks: DoctorCheck[] = [];

  if (deps.isOnPath('claude')) {
    checks.push({
      category: 'Claude Code Integration',
      name: 'claude CLI',
      status: 'ok',
      message: 'claude command is available on PATH',
    });
  } else {
    checks.push({
      category: 'Claude Code Integration',
      name: 'claude CLI',
      status: 'warn',
      message: 'claude command is not on PATH',
      remedy: "Install Claude Code CLI if you plan to use 'nightowl classify' or 'nightowl eval'.",
    });
  }

  if (!root) return checks;

  const [personal, shared] = await Promise.all([
    deps.readSettings(root, PERSONAL_SETTINGS),
    deps.readSettings(root, SHARED_SETTINGS),
  ]);

  const inPersonal = hasNightowlHooks(personal.value);
  const inShared = hasNightowlHooks(shared.value);

  if (inPersonal && inShared) {
    checks.push({
      category: 'Claude Code Integration',
      name: 'Claude settings hooks',
      status: 'warn',
      message: 'Hooks are configured in both personal and shared settings files (duplicate events)',
      remedy: 'Remove NightOwl hooks from one file to avoid duplicate logging.',
    });
  } else if (inPersonal) {
    checks.push({
      category: 'Claude Code Integration',
      name: 'Claude settings hooks',
      status: 'ok',
      message: `Hooks configured in ${PERSONAL_SETTINGS}`,
    });
  } else if (inShared) {
    checks.push({
      category: 'Claude Code Integration',
      name: 'Claude settings hooks',
      status: 'ok',
      message: `Hooks configured in ${SHARED_SETTINGS}`,
    });
  } else {
    checks.push({
      category: 'Claude Code Integration',
      name: 'Claude settings hooks',
      status: 'warn',
      message: 'No NightOwl hooks found in Claude Code settings',
      remedy: "Run 'nightowl init' to configure Claude Code hooks.",
    });
  }

  return checks;
}

export async function checkAgentHooks(deps: DoctorDeps, root: string | null): Promise<readonly DoctorCheck[]> {
  const checks: DoctorCheck[] = [];
  if (!root) return checks;

  const cursorRaw = await deps.readTextIfExists(join(root, '.cursor/hooks.json'));
  if (cursorRaw === null) {
    checks.push({
      category: 'Agent Hooks',
      name: 'Cursor hooks',
      status: 'warn',
      message: 'No .cursor/hooks.json with NightOwl hooks',
      remedy: "Run 'nightowl init --agents cursor' to install Cursor hooks.",
    });
  } else {
    try {
      const doc = JSON.parse(cursorRaw) as unknown;
      if (hasCursorNightowlHooks(doc)) {
        checks.push({
          category: 'Agent Hooks',
          name: 'Cursor hooks',
          status: 'ok',
          message: 'NightOwl hooks present in .cursor/hooks.json (verified)',
        });
      } else {
        checks.push({
          category: 'Agent Hooks',
          name: 'Cursor hooks',
          status: 'warn',
          message: '.cursor/hooks.json exists but has no NightOwl entries',
          remedy: "Run 'nightowl init --agents cursor'.",
        });
      }
    } catch {
      checks.push({
        category: 'Agent Hooks',
        name: 'Cursor hooks',
        status: 'warn',
        message: '.cursor/hooks.json is not valid JSON',
        remedy: 'Fix or remove the file, then re-run nightowl init.',
      });
    }
  }

  for (const spec of AGENT_CONFIGS) {
    const raw = await deps.readTextIfExists(join(root, spec.file));
    if (raw === null) {
      checks.push({
        category: 'Agent Hooks',
        name: `${spec.id} config`,
        status: 'warn',
        message: `Missing ${spec.file} (maturity: ${maturityOf(spec.id)})`,
        remedy: `Run 'nightowl init --agents ${spec.id}' or ignore if you do not use ${spec.id}.`,
      });
      continue;
    }
    try {
      const doc = JSON.parse(raw) as unknown;
      if (hasCompleteBestEffortShape(doc, spec.id)) {
        checks.push({
          category: 'Agent Hooks',
          name: `${spec.id} config`,
          status: 'ok',
          message: `NightOwl entry present in ${spec.file} (${maturityOf(spec.id)})`,
        });
      } else if (hasNightowlAgentMarker(doc, spec.id)) {
        checks.push({
          category: 'Agent Hooks',
          name: `${spec.id} config`,
          status: 'warn',
          message: `${spec.file} NightOwl shape incomplete (missing command/agent fields or Windsurf events)`,
          remedy: `Run 'nightowl init --agents ${spec.id}' to repair the documented contract.`,
        });
      } else {
        checks.push({
          category: 'Agent Hooks',
          name: `${spec.id} config`,
          status: 'warn',
          message: `${spec.file} exists without a NightOwl entry`,
          remedy: `Run 'nightowl init --agents ${spec.id}'.`,
        });
      }
    } catch {
      checks.push({
        category: 'Agent Hooks',
        name: `${spec.id} config`,
        status: 'warn',
        message: `${spec.file} is not valid JSON`,
        remedy: 'Fix or remove the file, then re-run nightowl init.',
      });
    }
  }

  for (const id of AGENT_IDS) {
    if (maturityOf(id) !== 'manual') continue;
    checks.push({
      category: 'Agent Hooks',
      name: `${id} setup`,
      status: 'ok',
      message: `${id} is manual maturity — configure a wrap to 'nightowl log --agent ${id}' (see README)`,
    });
  }

  for (const spec of LEGACY_AGENT_CONFIGS) {
    const raw = await deps.readTextIfExists(join(root, spec.file));
    if (raw === null) continue;
    checks.push({
      category: 'Agent Hooks',
      name: `${spec.id} legacy file`,
      status: 'warn',
      message: `Legacy NightOwl marker still present at ${spec.file} (${spec.id} is now manual maturity)`,
      remedy: "Run 'nightowl uninstall' then 'nightowl init' (or remove the file) and use a manual wrap — see README.",
    });
  }

  return checks;
}

async function warnIfNotExecutable(
  deps: DoctorDeps,
  hookPath: string,
  label: string,
): Promise<DoctorCheck | null> {
  const platform = deps.platform?.() ?? process.platform;
  if (platform === 'win32') return null;
  const isExecutable = deps.isExecutable ?? defaultIsExecutable;
  if (await isExecutable(hookPath)) return null;
  return {
    category: 'Git Hooks',
    name: `${label} executable`,
    status: 'warn',
    message: `${label} is not executable`,
    remedy: `Run 'chmod +x ${label}' so Git can invoke the NightOwl hook.`,
  };
}

export async function checkHooks(deps: DoctorDeps, root: string | null): Promise<readonly DoctorCheck[]> {
  const checks: DoctorCheck[] = [];
  if (!root) return checks;

  const manager = detectHookManager(root);
  if (manager.kind === 'husky') {
    for (const hook of GIT_HOOKS) {
      const hookPath = join(root, '.husky', hook.name);
      const content = await deps.readTextIfExists(hookPath);
      const runsCommand = content !== null && content.includes(`nightowl ${hook.command}`);

      if (runsCommand) {
        checks.push({
          category: 'Git Hooks',
          name: `${hook.name} hook (husky)`,
          status: 'ok',
          message: `${hook.name} (husky) runs 'nightowl ${hook.command}'`,
        });
        const execWarn = await warnIfNotExecutable(deps, hookPath, `.husky/${hook.name}`);
        if (execWarn) checks.push(execWarn);
      } else {
        checks.push({
          category: 'Git Hooks',
          name: `${hook.name} hook (husky)`,
          status: 'warn',
          message: `.husky/${hook.name} does not call 'nightowl ${hook.command}'`,
          remedy: `Add 'command -v nightowl >/dev/null 2>&1 && nightowl ${hook.command} || true' to .husky/${hook.name}.`,
        });
      }
    }
  } else if (manager.kind === 'lefthook') {
    const configPath = join(root, manager.configPath!);
    const content = await deps.readTextIfExists(configPath);
    for (const hook of GIT_HOOKS) {
      const runsCommand = content !== null && content.includes(`nightowl ${hook.command}`);

      if (runsCommand) {
        checks.push({
          category: 'Git Hooks',
          name: `${hook.name} hook (lefthook)`,
          status: 'ok',
          message: `${hook.name} (lefthook) runs 'nightowl ${hook.command}'`,
        });
      } else {
        checks.push({
          category: 'Git Hooks',
          name: `${hook.name} hook (lefthook)`,
          status: 'warn',
          message: `${manager.configPath} does not configure ${hook.name} to call 'nightowl ${hook.command}'`,
          remedy: `Add nightowl ${hook.command} command under ${hook.name} in ${manager.configPath}.`,
        });
      }
    }
  } else {
    for (const hook of GIT_HOOKS) {
      const hookPath = join(root, '.git', 'hooks', hook.name);
      const content = await deps.readTextIfExists(hookPath);
      const runsCommand = content !== null && content.includes(`nightowl ${hook.command}`);

      if (runsCommand) {
        checks.push({
          category: 'Git Hooks',
          name: `${hook.name} hook`,
          status: 'ok',
          message: `${hook.name} runs 'nightowl ${hook.command}'`,
        });
        const execWarn = await warnIfNotExecutable(deps, hookPath, `.git/hooks/${hook.name}`);
        if (execWarn) checks.push(execWarn);
      } else {
        checks.push({
          category: 'Git Hooks',
          name: `${hook.name} hook`,
          status: 'warn',
          message: `${hook.name} does not call 'nightowl ${hook.command}'`,
          remedy: `Run 'nightowl init' to install the ${hook.name} hook.`,
        });
      }
    }
  }

  const gitignorePath = join(root, '.gitignore');
  const gitignoreContent = await deps.readTextIfExists(gitignorePath);
  const ignoresNightowl =
    gitignoreContent !== null &&
    gitignoreContent
      .split('\n')
      .some((line) => line.trim() === NIGHTOWL_IGNORE || line.trim() === '.nightowl');

  if (ignoresNightowl) {
    checks.push({
      category: 'Git Hooks',
      name: '.gitignore entry',
      status: 'ok',
      message: '.nightowl/ is ignored in .gitignore',
    });
  } else {
    checks.push({
      category: 'Git Hooks',
      name: '.gitignore entry',
      status: 'warn',
      message: '.nightowl/ is not ignored in .gitignore',
      remedy: "Run 'nightowl init' to add .nightowl/ to .gitignore.",
    });
  }

  return checks;
}

export async function checkWorkspace(root: string | null): Promise<readonly DoctorCheck[]> {
  const checks: DoctorCheck[] = [];
  if (!root) return checks;
  if (!(await hasWorkspaceConfig(root))) return checks;

  const workspaces = await discoverWorkspaces(root);
  if (workspaces.length === 0) {
    checks.push({
      category: 'Workspace',
      name: 'Workspace discovery',
      status: 'warn',
      message: 'Workspace config present but no packages discovered (check globs like packages/*)',
      remedy:
        'Ensure package dirs match workspace globs (simple * one-segment globs), or remove stale workspace config.',
    });
  } else {
    checks.push({
      category: 'Workspace',
      name: 'Workspace discovery',
      status: 'ok',
      message: `Discovered ${workspaces.length} workspace package${workspaces.length === 1 ? '' : 's'}`,
    });
  }
  return checks;
}

export async function checkStorage(deps: DoctorDeps, root: string | null): Promise<readonly DoctorCheck[]> {
  const checks: DoctorCheck[] = [];
  if (!root) return checks;

  const dbPath = join(root, DATA_DIR, DB_FILE);
  if (!existsSync(dbPath)) {
    checks.push({
      category: 'NightOwl Database',
      name: 'Database file',
      status: 'warn',
      message: `Database file ${DATA_DIR}/${DB_FILE} does not exist yet`,
      remedy: "Run 'nightowl init' to initialize the local storage database.",
    });
    return checks;
  }

  checks.push({
    category: 'NightOwl Database',
    name: 'Database file',
    status: 'ok',
    message: `Database exists at ${DATA_DIR}/${DB_FILE}`,
  });

  let store: Store | null = null;
  try {
    store = await deps.openStore({ cwd: root, readOnly: true });

    // Verify integrity using PRAGMA integrity_check
    const integrity = store.pragma('integrity_check');
    if (integrity === 'ok') {
      checks.push({
        category: 'NightOwl Database',
        name: 'Database integrity',
        status: 'ok',
        message: 'Database integrity check passed (ok)',
      });
    } else {
      checks.push({
        category: 'NightOwl Database',
        name: 'Database integrity',
        status: 'fail',
        message: `Database integrity check failed: ${String(integrity)}`,
        remedy: `Database is corrupted. Backup and re-initialize ${DATA_DIR}/${DB_FILE}.`,
      });
    }

    // Verify schema version
    const version = store.pragma('user_version');
    if (version === CURRENT_SCHEMA_VERSION) {
      checks.push({
        category: 'NightOwl Database',
        name: 'Schema version',
        status: 'ok',
        message: `Schema version is ${version} (up to date)`,
      });
    } else if (typeof version === 'number' && version < CURRENT_SCHEMA_VERSION) {
      checks.push({
        category: 'NightOwl Database',
        name: 'Schema version',
        status: 'warn',
        message: `Schema version ${version} is older than current version ${CURRENT_SCHEMA_VERSION}`,
        remedy: "Run 'nightowl init' or another write command to migrate the database.",
      });
    } else {
      checks.push({
        category: 'NightOwl Database',
        name: 'Schema version',
        status: 'fail',
        message: `Schema version ${version} is newer than supported version ${CURRENT_SCHEMA_VERSION}`,
        remedy: 'Upgrade your NightOwl CLI to work with this database.',
      });
    }

    // Report stats (align readiness with report JSON `total`, which excludes dismissed)
    const failures = store.countFailures();
    const dismissed = failures.byStatus['dismissed'] ?? 0;
    const reportable = failures.total - dismissed;
    const eventCount = store.listEvents().length;
    const signalCounts = store.countEventsByKind(SIGNAL_KINDS, null);
    const signalParts = SIGNAL_KINDS.map((kind) => `${kind} ${signalCounts[kind] ?? 0}`);
    checks.push({
      category: 'NightOwl Database',
      name: 'Database statistics',
      status: 'ok',
      message: `${eventCount} events recorded, ${failures.total} failures recorded (${reportable} reportable)`,
    });
    checks.push({
      category: 'NightOwl Database',
      name: 'Signals readiness',
      status: 'ok',
      message: `Signals: ${signalParts.join(', ')}`,
    });
    if (reportable === 0) {
      checks.push({
        category: 'NightOwl Database',
        name: 'Report readiness',
        status: 'warn',
        message: 'No failures recorded yet — report/CI gate will have little signal',
        remedy:
          "Record AI failures via agent/git hooks (run 'nightowl init' if needed), then re-run doctor before relying on report.",
      });
    }

    const measure = deps.measureSync ?? measureSync;
    const budgetMs = deps.reportQueryBudgetMs ?? REPORT_QUERY_BUDGET_MS;
    const now = deps.now?.() ?? new Date();
    const since = sinceDaysAgo(now, DOCTOR_REPORT_SAMPLE_DAYS);
    const timed = measure(() => store!.countFailuresForReport(since));
    const ms = Math.round(timed.ms);
    if (timed.ms > budgetMs) {
      checks.push({
        category: 'NightOwl Database',
        name: 'Report query timing',
        status: 'warn',
        message: `Report-read sample took ${ms}ms (budget ${budgetMs}ms over last ${DOCTOR_REPORT_SAMPLE_DAYS}d)`,
        remedy:
          'Run nightowl prune --vacuum on old snapshots, keep --since windows tight, or use nightowl report --debug-timing to see which step is slow.',
      });
    } else {
      checks.push({
        category: 'NightOwl Database',
        name: 'Report query timing',
        status: 'ok',
        message: `Report-read sample ${ms}ms (budget ${budgetMs}ms, last ${DOCTOR_REPORT_SAMPLE_DAYS}d)`,
      });
    }
  } catch (error) {
    checks.push({
      category: 'NightOwl Database',
      name: 'Database access',
      status: 'fail',
      message: `Failed to inspect database: ${errorMessage(error)}`,
      remedy: `Check file permissions or re-initialize ${DATA_DIR}/${DB_FILE}.`,
    });
  } finally {
    store?.close();
  }

  return checks;
}

export function formatDoctorOutput(checks: readonly DoctorCheck[]): string {
  const categories = Array.from(new Set(checks.map((c) => c.category)));
  const lines: string[] = ['NightOwl Doctor Diagnostics:', ''];

  for (const cat of categories) {
    lines.push(cat);
    const catChecks = checks.filter((c) => c.category === cat);
    for (const check of catChecks) {
      const symbol = check.status === 'ok' ? '✓' : check.status === 'warn' ? '!' : '✗';
      lines.push(`  ${symbol} ${check.message}`);
    }
    lines.push('');
  }

  const okCount = checks.filter((c) => c.status === 'ok').length;
  const warnCount = checks.filter((c) => c.status === 'warn').length;
  const failCount = checks.filter((c) => c.status === 'fail').length;

  lines.push(`Result: ${okCount} ok, ${warnCount} warning${warnCount === 1 ? '' : 's'}, ${failCount} failure${failCount === 1 ? '' : 's'}.`);

  const issues = checks.filter((c) => c.status !== 'ok');
  if (issues.length > 0) {
    lines.push('');
    lines.push('Suggestions & Remedies:');
    for (const issue of issues) {
      const prefix = issue.status === 'fail' ? '✗' : '!';
      const remedyText = issue.remedy ? ` → ${issue.remedy}` : '';
      lines.push(`  ${prefix} [${issue.name}]: ${issue.message}${remedyText}`);
    }
  }

  return lines.join('\n') + '\n';
}

export function createDoctorCommand(deps: DoctorDeps = defaultDoctorDeps): Command {
  return {
    name: 'doctor',
    summary: 'Check environment, configuration and database health',
    help: renderCommandHelp({
      name: 'doctor',
      usage: '[options]',
      description: [
        'Diagnoses system requirements, Git repository status, Claude Code hooks,',
        'multi-agent ingest configs by maturity (verified / best-effort / manual),',
        'including best-effort config shape (not only file presence),',
        'Git hook authenticity (commands + execute bit on POSIX; skipped on Windows), monorepo workspace',
        'discovery when configured, and report readiness (failures + CI/PR/revert signals).',
        'Also samples report-query timing against a local budget (warns when slow).',
        'Paths with \\ are normalized like / for module/workspace checks. See README for per-agent limits.',
      ],
      options: [
        ['--strict', 'Exit with code 1 if any warnings or failures are detected.'],
      ],
    }),
    run: async (args: readonly string[], io: Io): Promise<number> => {
      let strict = false;
      try {
        const { values } = parseArgs({
          args: [...args],
          options: { strict: { type: 'boolean' } },
          strict: true,
          allowPositionals: false,
        });
        strict = values.strict === true;
      } catch (error) {
        io.stderr(`nightowl doctor: ${printable(errorMessage(error))}\nRun 'nightowl doctor --help'.\n`);
        return 1;
      }

      const cwd = deps.cwd();
      const allChecks: DoctorCheck[] = [];

      const runtimeChecks = await checkRuntime(deps);
      allChecks.push(...runtimeChecks);

      const { checks: gitChecks, root } = await checkGit(deps, cwd);
      allChecks.push(...gitChecks);

      const claudeChecks = await checkClaude(deps, root);
      allChecks.push(...claudeChecks);

      const agentChecks = await checkAgentHooks(deps, root);
      allChecks.push(...agentChecks);

      const hookChecks = await checkHooks(deps, root);
      allChecks.push(...hookChecks);

      const workspaceChecks = await checkWorkspace(root);
      allChecks.push(...workspaceChecks);

      const storageChecks = await checkStorage(deps, root);
      allChecks.push(...storageChecks);

      const output = formatDoctorOutput(allChecks);
      io.stdout(output);

      const hasFail = allChecks.some((c) => c.status === 'fail');
      const hasWarn = allChecks.some((c) => c.status === 'warn');

      if (hasFail) return 1;
      if (strict && hasWarn) return 1;
      return 0;
    },
  };
}

export const doctorCommand = createDoctorCommand();

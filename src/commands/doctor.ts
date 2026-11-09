import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { errorMessage } from '../cli/errors.js';
import { renderCommandHelp } from '../cli/help.js';
import type { Io } from '../cli/io.js';
import { runGit } from '../hooks/git/run-git.js';
import {
  hasNightowlHooks,
  PERSONAL_SETTINGS,
  readSettings,
  SHARED_SETTINGS,
} from '../setup/claude-settings.js';
import { readTextIfExists } from '../setup/fs-utils.js';
import { GIT_HOOKS } from '../setup/git-hook.js';
import { NIGHTOWL_IGNORE } from '../setup/gitignore.js';
import { isOnPath } from '../setup/path.js';
import { printable } from '../shared/printable.js';
import { CURRENT_SCHEMA_VERSION } from '../storage/migrations.js';
import { findProjectRoot } from '../storage/project-root.js';
import { loadSqlite } from '../storage/sqlite.js';
import { DATA_DIR, DB_FILE, openStore, type Store } from '../storage/store.js';
import type { Command } from './command.js';

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

export async function checkHooks(deps: DoctorDeps, root: string | null): Promise<readonly DoctorCheck[]> {
  const checks: DoctorCheck[] = [];
  if (!root) return checks;

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

    // Report stats
    const failures = store.countFailures();
    const eventCount = store.listEvents().length;
    checks.push({
      category: 'NightOwl Database',
      name: 'Database statistics',
      status: 'ok',
      message: `${eventCount} events recorded, ${failures.total} failures recorded`,
    });
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
        'Git hooks, and local SQLite database health.',
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

      const hookChecks = await checkHooks(deps, root);
      allChecks.push(...hookChecks);

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

import { relative } from 'node:path';
import { parseArgs } from 'node:util';
import { AGENT_IDS } from '../agents/ids.js';
import { errorMessage } from '../cli/errors.js';
import { renderCommandHelp } from '../cli/help.js';
import type { Io } from '../cli/io.js';
import { type AgentInstallLine, installSelectedAgents, parseAgentsList } from '../setup/agents-install.js';
import { checkClaudeHooks, type InstallOutcome, installClaudeHooks } from '../setup/claude-install.js';
import { PERSONAL_SETTINGS, SHARED_SETTINGS, type SettingsFile } from '../setup/claude-settings.js';
import { SetupError } from '../setup/fs-utils.js';
import { GIT_HOOKS, type GitHookSpec, hookLine, type InstallResult, installGitHook } from '../setup/git-hook.js';
import { ensureGitignoreEntry, type FileChange, NIGHTOWL_IGNORE } from '../setup/gitignore.js';
import { detectHookManager } from '../setup/hook-manager.js';
import { isOnPath } from '../setup/path.js';
import { printable } from '../shared/printable.js';
import { findProjectRoot } from '../storage/project-root.js';
import { DataDirError, openStore } from '../storage/store.js';
import type { Command } from './command.js';

export interface InitDeps {
  readonly cwd: () => string;
  readonly isOnPath: (command: string) => boolean;
  readonly installGitHook: (root: string, hook: GitHookSpec) => Promise<InstallResult>;
}

const defaultDeps: InitDeps = {
  cwd: () => process.cwd(),
  isOnPath: (command) => isOnPath(command, process.env.PATH),
  installGitHook,
};

async function tryInstallHook(deps: InitDeps, root: string, hook: GitHookSpec): Promise<InstallResult> {
  try {
    return await deps.installGitHook(root, hook);
  } catch (error) {
    return { status: 'manual', reason: error instanceof Error ? error.message : String(error) };
  }
}

function describeChange(file: string, change: FileChange | string, detail: string): string | null {
  return change === 'unchanged' ? null : `  ${change} ${file} (${detail})`;
}

function parseOptions(
  args: readonly string[],
  io: Io,
): { readonly shared: boolean; readonly agents: Exclude<ReturnType<typeof parseAgentsList>, string> } | null {
  try {
    const { values } = parseArgs({
      args: [...args],
      options: {
        shared: { type: 'boolean' },
        agents: { type: 'string' },
      },
      strict: true,
      allowPositionals: false,
    });
    const agents = parseAgentsList(values.agents);
    if (typeof agents === 'string') {
      io.stderr(`nightowl init: ${agents}\nRun 'nightowl init --help'.\n`);
      return null;
    }
    return { shared: values.shared === true, agents };
  } catch (error) {
    io.stderr(`nightowl init: ${printable(errorMessage(error))}\nRun 'nightowl init --help'.\n`);
    return null;
  }
}

function hookDetail(added: readonly string[], upgraded: number): string {
  const parts = [
    ...(added.length > 0 ? [`hooks: ${added.join(', ')}`] : []),
    ...(upgraded > 0 ? [`upgraded ${upgraded} ${upgraded === 1 ? 'hook' : 'hooks'}`] : []),
  ];
  return parts.join('; ');
}

// Both .gitignore entries are reported on one line, in the order they were written.
function gitignoreLine(claude: InstallOutcome | null, nightowl: FileChange): string | null {
  const personal = claude?.kind === 'installed' ? claude.gitignore : 'unchanged';
  const added = [...(personal === 'unchanged' ? [] : [PERSONAL_SETTINGS]), ...(nightowl === 'unchanged' ? [] : [NIGHTOWL_IGNORE])];
  const status = personal === 'unchanged' ? nightowl : personal;
  return describeChange('.gitignore', status, `added ${added.join(', ')}`);
}

function claudeLine(claude: InstallOutcome): string | null {
  return claude.kind === 'installed'
    ? describeChange(claude.file, claude.result.status, hookDetail(claude.result.added, claude.result.upgraded))
    : describeChange(claude.file, claude.upgraded > 0 ? 'updated' : 'unchanged', hookDetail([], claude.upgraded));
}

function claudeNotes(claude: InstallOutcome): { readonly out: string; readonly err: string } {
  if (claude.kind === 'elsewhere') {
    const move = claude.file === SHARED_SETTINGS ? 'make them personal: nightowl uninstall && nightowl init' : 'share them: nightowl uninstall && nightowl init --shared';
    return { out: `Claude Code hooks stay in ${claude.file}. To ${move}\n`, err: '' };
  }
  if (claude.alsoIn === null) return { out: '', err: '' };
  return {
    out: '',
    err: `nightowl init: warning: NightOwl hooks are in both ${claude.file} and ${claude.alsoIn}, so every event is recorded twice. Remove them from one file.\n`,
  };
}

function reportGitHooks(gitHooks: ReadonlyArray<{ hook: GitHookSpec; result: InstallResult }>, root: string) {
  const lines = gitHooks.map(({ hook, result }) =>
    result.status === 'manual' ? null : describeChange(relative(root, result.path), result.status, `runs nightowl ${hook.command}`),
  );
  const manual = gitHooks.flatMap(({ hook, result }) => {
    if (result.status !== 'manual') return [];
    const manager = detectHookManager(root, result.reason);
    return [
      `nightowl init: git ${hook.name} hook not installed (${result.reason}).\n` +
      `${manager.getInstructions(hook.name, hook.command)}\n`,
    ];
  });
  return { lines, manual };
}

function agentLines(rows: readonly AgentInstallLine[]): { readonly lines: string[]; readonly warnings: string[] } {
  const lines: string[] = [];
  const warnings: string[] = [];
  for (const row of rows) {
    if (row.warning) warnings.push(`nightowl init: warning: ${row.file}: ${row.warning}\n`);
    const line = describeChange(row.file, row.status, row.detail);
    if (line !== null) lines.push(line);
  }
  return { lines, warnings };
}

async function setUp(root: string, file: SettingsFile, installClaude: boolean) {
  if (installClaude) await checkClaudeHooks(root, file);
  (await openStore({ cwd: root })).close();
  const claude = installClaude ? await installClaudeHooks(root, file) : null;
  const gitignore = await ensureGitignoreEntry(root);
  return { claude, gitignore };
}

export function createInitCommand(deps: InitDeps = defaultDeps): Command {
  return {
    name: 'init',
    summary: 'Set up NightOwl hooks in this project',
    help: renderCommandHelp({
      name: 'init',
      usage: '[--shared] [--agents <list>]',
      description: [
        'Adds, without removing anything already there:',
        '  Claude Code + Cursor (verified) and best-effort agent hook configs that run nightowl log',
        '  Manual-maturity agents (e.g. aider, copilot-workspace) are not given fake native hooks — see README',
        '  .git/hooks/pre-commit        runs nightowl precommit',
        '  .git/hooks/post-commit       runs nightowl postcommit',
        `  .gitignore                   ${NIGHTOWL_IGNORE} and, if needed, ${PERSONAL_SETTINGS}`,
        'and creates the local database in .nightowl/. Safe to run again.',
        "Undo with 'nightowl uninstall'.",
      ],
      options: [
        ['--shared', `Put the Claude Code hooks in ${SHARED_SETTINGS}, shared with your team`],
        [
          '--agents <list>',
          `Comma-separated agents (default: all). Known: ${AGENT_IDS.join(', ')}. Not every agent has a native hook — see README maturity.`,
        ],
      ],
    }),
    run: async (args, io) => {
      const options = parseOptions(args, io);
      if (options === null) return 1;
      const root = findProjectRoot(deps.cwd());
      if (root === null) {
        io.stderr(`nightowl init: no git repository found at or above ${deps.cwd()}\n`);
        return 1;
      }

      const wantClaude = options.agents.includes('claude-code');
      let done;
      try {
        done = await setUp(root, options.shared ? SHARED_SETTINGS : PERSONAL_SETTINGS, wantClaude);
      } catch (error) {
        if (!(error instanceof SetupError || error instanceof DataDirError)) throw error;
        io.stderr(`nightowl init: ${printable(error.message)}\nFix it and run 'nightowl init' again.\n`);
        return 1;
      }
      const otherAgents = await installSelectedAgents(root, options.agents);
      const gitHooks: Array<{ hook: GitHookSpec; result: InstallResult }> = [];
      for (const hook of GIT_HOOKS) gitHooks.push({ hook, result: await tryInstallHook(deps, root, hook) });

      const git = reportGitHooks(gitHooks, root);
      const agents = agentLines(otherAgents);
      const lines = [
        ...(done.claude ? [claudeLine(done.claude)] : []),
        gitignoreLine(done.claude, done.gitignore),
        ...agents.lines,
        ...git.lines,
      ].filter((line): line is string => line !== null);
      const notes = done.claude ? claudeNotes(done.claude) : { out: '', err: '' };
      io.stdout(
        (lines.length === 0 ? `NightOwl is already set up in ${root}\n` : `NightOwl is set up in ${root}\n${lines.join('\n')}\n`) +
          notes.out,
      );
      for (const message of git.manual) io.stderr(message);
      for (const warning of agents.warnings) io.stderr(warning);
      if (notes.err !== '') io.stderr(notes.err);
      if (!deps.isOnPath('nightowl')) {
        io.stderr(
          "nightowl init: warning: 'nightowl' is not on your PATH, so the hooks cannot run.\n" +
            '  Install it with: npm i -g @hoanghainh/nightowl-evals\n',
        );
      }
      return 0;
    },
  };
}

export const initCommand = createInitCommand();

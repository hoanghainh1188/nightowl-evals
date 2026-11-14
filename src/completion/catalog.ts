import type { Command } from '../commands/command.js';

export const COMPLETION_SHELLS = Object.freeze(['bash', 'zsh', 'fish'] as const);
export type CompletionShell = (typeof COMPLETION_SHELLS)[number];

export function isCompletionShell(value: string): value is CompletionShell {
  return (COMPLETION_SHELLS as readonly string[]).includes(value);
}

/** Long flags (and notable shorts) offered after each command. Keep in sync with command help. */
export const COMMAND_FLAGS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  init: ['--shared', '--agents'],
  doctor: ['--strict', '--config'],
  log: ['--agent'],
  report: [
    '--since',
    '--baseline-since',
    '--depth',
    '--workspace',
    '--agent',
    '--json',
    '--output',
    '-o',
    '--fail-on-rate',
    '--debug-timing',
    '--config',
  ],
  'customer-report': [
    '--lang',
    '--format',
    '--since',
    '--depth',
    '--workspace',
    '--agent',
    '--output',
    '-o',
    '--redact-paths',
  ],
  dashboard: [
    '--since',
    '--depth',
    '--workspace',
    '--agent',
    '--output',
    '-o',
    '--open',
    '--redact-paths',
    '--config',
  ],
  digest: [
    '--since',
    '--depth',
    '--workspace',
    '--agent',
    '--format',
    '--output',
    '-o',
    '--redact-paths',
    '--config',
  ],
  'share-pack': [
    '--since',
    '--depth',
    '--agent',
    '--no-redact-paths',
    '--output',
    '-o',
    '--archive',
    '--config',
  ],
  export: [
    '--out',
    '--format',
    '--regressions-dir',
    '--force',
    '--since',
    '--category',
    '--status',
    '--redact-paths',
    '--privacy-dry-run',
    '--config',
  ],
  'ingest-ci': ['--file', '--format', '--commit'],
  'ingest-pr': ['--file', '--github', '--pr'],
  'ingest-revert': ['--since'],
  precommit: [],
  postcommit: [],
  prune: ['--days', '--profile', '--dry-run', '--vacuum', '--config'],
  failures: [],
  classify: ['--offline', '--yes', '--transport', '--limit', '--model', '--redo'],
  eval: [
    '--yes',
    '--input',
    '--model',
    '--limit',
    '--test-command',
    '--test-timeout',
    '--require-tests',
    '--label',
    '--report',
    '--baseline',
    '--output',
    '-o',
  ],
  'eval-compare': ['--input', '--baseline', '--format', '--output', '-o'],
  review: ['-i', '--interactive', '--status', '--source', '--agent', '--limit', '--json'],
  'suggest-rules': [
    '--since',
    '--category',
    '--agent',
    '--status',
    '--min-count',
    '--limit',
    '--output',
    '--write',
    '--force',
    '--yes',
    '--transport',
    '--model',
  ],
  'suggest-regressions': [
    '--since',
    '--category',
    '--agent',
    '--status',
    '--limit',
    '--framework',
    '--output',
    '--force',
    '--yes',
    '--transport',
    '--model',
  ],
  'rule-impact': [
    'mark',
    '--label',
    '--id',
    '--category',
    '--agent',
    '--module',
    '--depth',
    '--at',
    '--before-days',
    '--after-days',
    '--json',
  ],
  uninstall: [],
  completion: [],
});

export interface CompletionCommand {
  readonly name: string;
  readonly summary: string;
  readonly flags: readonly string[];
}

export interface CompletionCatalog {
  readonly commands: readonly CompletionCommand[];
}

export function buildCatalog(commands: readonly Command[]): CompletionCatalog {
  return {
    commands: commands.map((command) => ({
      name: command.name,
      summary: command.summary,
      flags: COMMAND_FLAGS[command.name] ?? [],
    })),
  };
}

/** Default catalog from the static flag table (avoids importing the command registry). */
export function buildDefaultCatalog(): CompletionCatalog {
  return {
    commands: Object.entries(COMMAND_FLAGS).map(([name, flags]) => ({
      name,
      summary: name,
      flags,
    })),
  };
}

export function assertCatalogCoversCommands(commands: readonly Command[]): void {
  for (const command of commands) {
    if (!(command.name in COMMAND_FLAGS)) {
      throw new Error(`completion catalog missing flags for command: ${command.name}`);
    }
  }
  for (const name of Object.keys(COMMAND_FLAGS)) {
    if (!commands.some((command) => command.name === name)) {
      throw new Error(`completion catalog has unknown command: ${name}`);
    }
  }
}

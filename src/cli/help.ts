import type { Command } from '../commands/command.js';

export function renderHelp(commands: readonly Command[]): string {
  const width = Math.max(...commands.map((command) => command.name.length));
  const rows = commands.map((command) => `  ${command.name.padEnd(width)}  ${command.summary}`);
  return [
    'NightOwl Evals: record AI coding failures as a local eval suite.',
    '',
    'Usage: nightowl <command> [options]',
    '',
    'Commands:',
    ...rows,
    '',
    'Options:',
    '  -h, --help     Show this help',
    '  -v, --version  Show the version',
    '',
    "Run 'nightowl <command> --help' for its options.",
    '',
  ].join('\n');
}

export interface CommandHelp {
  readonly name: string;
  // Text after `nightowl <name>`, e.g. `[options]`; empty when the command takes none.
  readonly usage: string;
  readonly description: readonly string[];
  // [flag, meaning] pairs; `-h, --help` is always added last.
  readonly options: ReadonlyArray<readonly [string, string]>;
}

export function renderCommandHelp(help: CommandHelp): string {
  const options = [...help.options, ['-h, --help', 'Show this help'] as const];
  const width = Math.max(...options.map(([flag]) => flag.length));
  return [
    `Usage: nightowl ${help.name}${help.usage === '' ? '' : ` ${help.usage}`}`,
    '',
    ...help.description,
    '',
    'Options:',
    ...options.map(([flag, meaning]) => `  ${flag.padEnd(width)}  ${meaning}`),
    '',
  ].join('\n');
}

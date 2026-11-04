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
  ].join('\n');
}

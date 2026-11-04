import { parseArgs } from 'node:util';
import pkg from '../../package.json' with { type: 'json' };
import type { Command } from '../commands/command.js';
import { commands as defaultCommands } from '../commands/index.js';
import { renderHelp } from './help.js';
import type { Io } from './io.js';

const HELP_HINT = "Run 'nightowl --help' to see available commands.";

function parseGlobal(argv: readonly string[]) {
  return parseArgs({
    args: [...argv],
    options: {
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
    strict: true,
    allowPositionals: true,
  });
}

// Global flags are only read before the command name; everything after it belongs to the command.
function splitAtCommand(argv: readonly string[]): { globals: readonly string[]; rest: readonly string[] } {
  const index = argv.findIndex((arg) => !arg.startsWith('-'));
  return index === -1
    ? { globals: argv, rest: [] }
    : { globals: argv.slice(0, index), rest: argv.slice(index) };
}

export async function run(
  argv: readonly string[],
  io: Io,
  commands: readonly Command[] = defaultCommands,
): Promise<number> {
  const { globals, rest } = splitAtCommand(argv);

  let flags: { help?: boolean; version?: boolean };
  try {
    flags = parseGlobal(globals).values;
  } catch (error) {
    io.stderr(`nightowl: ${(error as Error).message}\n${HELP_HINT}\n`);
    return 1;
  }

  if (flags.version) {
    io.stdout(`${pkg.version}\n`);
    return 0;
  }

  const [name, ...args] = rest;
  if (flags.help || name === undefined) {
    io.stdout(renderHelp(commands));
    return 0;
  }

  const command = commands.find((candidate) => candidate.name === name);
  if (!command) {
    io.stderr(`nightowl: unknown command '${name}'.\n${HELP_HINT}\n`);
    return 1;
  }
  return command.run(args, io);
}

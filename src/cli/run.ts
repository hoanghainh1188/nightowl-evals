import { parseArgs } from 'node:util';
import pkg from '../../package.json' with { type: 'json' };
import type { Command } from '../commands/command.js';
import { commands as defaultCommands } from '../commands/index.js';
import { printable } from '../shared/printable.js';
import { renderHelp } from './help.js';
import type { Io } from './io.js';

const HELP_HINT = "Run 'nightowl --help' to see available commands.";
const HELP_FLAGS: ReadonlySet<string> = new Set(['-h', '--help']);

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
    io.stderr(`nightowl: ${printable((error as Error).message)}\n${HELP_HINT}\n`);
    return 1;
  }

  if (flags.version) {
    io.stdout(`${pkg.version}\n`);
    return 0;
  }

  const [first, ...afterFirst] = rest;
  // `nightowl help <command>` is the same as `nightowl <command> --help`.
  const isHelpCommand = first === 'help';
  const [name, ...args] = isHelpCommand ? afterFirst : rest;
  // `help --help` and `help help` mean the general help too.
  const wantsGeneralHelp = isHelpCommand && (name === 'help' || (name !== undefined && HELP_FLAGS.has(name)));
  if (flags.help || name === undefined || wantsGeneralHelp) {
    io.stdout(renderHelp(commands));
    return 0;
  }

  const command = commands.find((candidate) => candidate.name === name);
  if (!command) {
    io.stderr(`nightowl: unknown command '${printable(name)}'.\n${HELP_HINT}\n`);
    return 1;
  }
  // Checked here, before the command runs, so asking for help never changes anything.
  if (isHelpCommand || args.some((arg) => HELP_FLAGS.has(arg))) {
    io.stdout(command.help);
    return 0;
  }
  return command.run(args, io);
}

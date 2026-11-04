import type { Command } from '../commands/command.js';
import { errorMessage, HOOK_COMMAND } from './errors.js';
import type { Io } from './io.js';
import { run } from './run.js';

// Hooks must never stop Claude Code or git, so `log` always exits 0.
export async function main(argv: readonly string[], io: Io, commands?: readonly Command[]): Promise<number> {
  try {
    return await run(argv, io, commands);
  } catch (error) {
    if (argv[0] === HOOK_COMMAND) return 0;
    io.stderr(`nightowl: ${errorMessage(error)}\n`);
    return 1;
  }
}

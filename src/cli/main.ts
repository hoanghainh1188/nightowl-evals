import type { Command } from '../commands/command.js';
import { errorMessage, isHookCommand } from './errors.js';
import type { Io } from './io.js';
import { run } from './run.js';

// Hooks must never stop Claude Code or git, so hook commands always exit 0.
export async function main(argv: readonly string[], io: Io, commands?: readonly Command[]): Promise<number> {
  try {
    return await run(argv, io, commands);
  } catch (error) {
    if (isHookCommand(argv[0])) return 0;
    io.stderr(`nightowl: ${errorMessage(error)}\n`);
    return 1;
  }
}

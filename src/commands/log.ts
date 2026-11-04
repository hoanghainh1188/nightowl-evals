import type { Command } from './command.js';

// Claude Code closes stdin right after writing the event; anything slower is a stuck pipe.
export const LOG_STDIN_TIMEOUT_MS = 500;

// Called by agent hooks on every tool use: it must never fail, print or block.
export const logCommand: Command = {
  name: 'log',
  summary: 'Record a hook event read from stdin (used by hooks)',
  run: async (_args, io) => {
    try {
      if (!io.stdin.isTTY) {
        await io.stdin.readAll(LOG_STDIN_TIMEOUT_MS);
      }
    } catch {
      // Swallowed on purpose: a broken event must not stop Claude Code or git.
    }
    return 0;
  },
};

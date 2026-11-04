import type { Command } from './command.js';

export function notImplemented(name: string, summary: string): Command {
  return {
    name,
    summary,
    run: async (_args, io) => {
      io.stderr(`nightowl ${name}: not implemented yet\n`);
      return 0;
    },
  };
}

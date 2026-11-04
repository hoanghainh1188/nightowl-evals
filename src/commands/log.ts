import { recordClaudeCodeEvent } from '../hooks/claude-code/record.js';
import type { StdinRead } from '../cli/io.js';
import type { Command } from './command.js';

// Claude Code closes stdin right after writing the event; anything slower is a stuck pipe.
export const LOG_STDIN_TIMEOUT_MS = 500;

export interface LogDeps {
  readonly cwd: () => string;
  readonly record: (input: StdinRead, cwd: string) => Promise<void>;
}

const defaultDeps: LogDeps = { cwd: () => process.cwd(), record: recordClaudeCodeEvent };

// Called by agent hooks on every tool use: it must never fail, print or block.
export function createLogCommand(deps: LogDeps = defaultDeps): Command {
  return {
    name: 'log',
    summary: 'Record a hook event read from stdin (used by hooks)',
    run: async (_args, io) => {
      try {
        if (!io.stdin.isTTY) {
          await deps.record(await io.stdin.readAll(LOG_STDIN_TIMEOUT_MS), deps.cwd());
        }
      } catch {
        // Swallowed on purpose: a broken event must not stop Claude Code or git.
      }
      return 0;
    },
  };
}

export const logCommand = createLogCommand();

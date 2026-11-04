import { recordClaudeCodeEvent } from '../hooks/claude-code/record.js';
import { renderCommandHelp } from '../cli/help.js';
import type { StdinRead } from '../cli/io.js';
import { INTERNAL_ENV } from '../shared/internal-env.js';
import type { Command } from './command.js';

// Claude Code closes stdin right after writing the event; anything slower is a stuck pipe.
export const LOG_STDIN_TIMEOUT_MS = 500;

export interface LogDeps {
  readonly cwd: () => string;
  readonly record: (input: StdinRead, cwd: string) => Promise<void>;
  readonly isInternal?: () => boolean;
}

const defaultDeps: LogDeps = { cwd: () => process.cwd(), record: recordClaudeCodeEvent };
const isInternalRun = () => process.env[INTERNAL_ENV] === '1';

// Called by agent hooks on every tool use: it must never fail, print or block.
export function createLogCommand(deps: LogDeps = defaultDeps): Command {
  return {
    name: 'log',
    summary: 'Record a hook event read from stdin (used by hooks)',
    help: renderCommandHelp({
      name: 'log',
      usage: '',
      description: [
        'Records a Claude Code hook event (prompt or file edit) read from stdin.',
        'Called by the Claude Code hooks; you do not run it yourself. Always exits 0 and prints nothing.',
      ],
      options: [],
    }),
    run: async (_args, io) => {
      try {
        if (!io.stdin.isTTY) {
          // Drain stdin either way so the writer never sees a broken pipe.
          const input = await io.stdin.readAll(LOG_STDIN_TIMEOUT_MS);
          if (!(deps.isInternal ?? isInternalRun)()) await deps.record(input, deps.cwd());
        }
      } catch {
        // Swallowed on purpose: a broken event must not stop Claude Code or git.
      }
      return 0;
    },
  };
}

export const logCommand = createLogCommand();

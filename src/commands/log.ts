import { recordAgentEvent } from '../agents/record.js';
import { AGENT_IDS } from '../agents/ids.js';
import { renderCommandHelp } from '../cli/help.js';
import type { StdinRead } from '../cli/io.js';
import { INTERNAL_ENV } from '../shared/internal-env.js';
import type { Command } from './command.js';
import { parseArgs } from 'node:util';

// Agent hooks close stdin right after writing the event; anything slower is a stuck pipe.
export const LOG_STDIN_TIMEOUT_MS = 500;

export interface LogDeps {
  readonly cwd: () => string;
  readonly record: (input: StdinRead, cwd: string, forcedAgent?: string | null) => Promise<void>;
  readonly isInternal?: () => boolean;
}

const defaultDeps: LogDeps = {
  cwd: () => process.cwd(),
  record: (input, cwd, forcedAgent) =>
    recordAgentEvent(input, cwd, forcedAgent === undefined ? {} : { forcedAgent }),
};
const isInternalRun = () => process.env[INTERNAL_ENV] === '1';

function parseAgentFlag(args: readonly string[]): string | null | 'error' {
  try {
    const { values } = parseArgs({
      args: [...args],
      options: { agent: { type: 'string' } },
      strict: true,
      allowPositionals: false,
    });
    return values.agent ?? null;
  } catch {
    return 'error';
  }
}

// Called by agent hooks on every tool use: it must never fail, print or block.
export function createLogCommand(deps: LogDeps = defaultDeps): Command {
  return {
    name: 'log',
    summary: 'Record a hook event read from stdin (used by hooks)',
    help: renderCommandHelp({
      name: 'log',
      usage: '[--agent <id>]',
      description: [
        'Records an agent hook event (prompt or file edit) read from stdin.',
        'Supports Claude Code, Cursor, Windsurf, Cline, Roo, Copilot Workspace, and Aider.',
        'Called by agent hooks; you do not run it yourself. Always exits 0 and prints nothing.',
      ],
      options: [[`--agent <id>`, `Force agent id (${AGENT_IDS.join(', ')}) when stdin is generic`]],
    }),
    run: async (args, io) => {
      try {
        const forced = parseAgentFlag(args);
        // Bad flags still exit 0: never block an agent hook.
        const forcedAgent = forced === 'error' ? null : forced;
        if (!io.stdin.isTTY) {
          const input = await io.stdin.readAll(LOG_STDIN_TIMEOUT_MS);
          if (!(deps.isInternal ?? isInternalRun)()) await deps.record(input, deps.cwd(), forcedAgent);
        }
      } catch {
        // Swallowed on purpose: a broken event must not stop the agent or git.
      }
      return 0;
    },
  };
}

export const logCommand = createLogCommand();

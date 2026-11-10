import { renderCommandHelp } from '../cli/help.js';
import {
  COMPLETION_SHELLS,
  buildDefaultCatalog,
  isCompletionShell,
  type CompletionCatalog,
  type CompletionShell,
} from '../completion/catalog.js';
import { renderCompletion } from '../completion/render.js';
import type { Command } from './command.js';

export interface CompletionDeps {
  readonly catalog?: () => CompletionCatalog;
}

export function createCompletionCommand(deps: CompletionDeps = {}): Command {
  return {
    name: 'completion',
    summary: 'Print shell completion scripts for bash, zsh, or fish',
    help: renderCommandHelp({
      name: 'completion',
      usage: '<bash|zsh|fish>',
      description: [
        'Prints a completion script for the given shell to stdout.',
        'Install with eval/source in your shell rc (see README). Does not write files or use the network.',
      ],
      options: [],
    }),
    run: async (args, io) => {
      if (args.length === 0) {
        io.stderr(`nightowl completion: missing shell (use ${COMPLETION_SHELLS.join('|')})\n`);
        return 1;
      }
      if (args.length > 1) {
        io.stderr(`nightowl completion: unexpected arguments\nRun 'nightowl completion --help'.\n`);
        return 1;
      }
      const shellRaw = (args[0] as string).toLowerCase();
      if (!isCompletionShell(shellRaw)) {
        io.stderr(
          `nightowl completion: unsupported shell: ${args[0]} (use ${COMPLETION_SHELLS.join('|')})\n`,
        );
        return 1;
      }
      const shell: CompletionShell = shellRaw;
      const catalog = (deps.catalog ?? buildDefaultCatalog)();
      io.stdout(renderCompletion(shell, catalog));
      return 0;
    },
  };
}

export const completionCommand = createCompletionCommand();

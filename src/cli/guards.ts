import { errorMessage, HOOK_COMMAND } from './errors.js';

interface Listenable {
  on(event: 'error', listener: (error: Error) => void): unknown;
}

export interface GuardTarget {
  readonly stdout: Listenable;
  readonly stderr: Listenable & { write(text: string): unknown };
  on(event: 'uncaughtException' | 'unhandledRejection', listener: (error: unknown) => void): unknown;
  exit(code: number): never;
}

// Errors that escape `main()` (closed pipes, stray rejections) end the process
// cleanly: silent exit 0 for the hook, a one-line message and exit 1 otherwise.
export function installProcessGuards(argv: readonly string[], target: GuardTarget): void {
  const isHook = argv[0] === HOOK_COMMAND;
  const ignore = () => {};
  target.stdout.on('error', ignore);
  target.stderr.on('error', ignore);

  const fail = (error: unknown) => {
    if (!isHook) target.stderr.write(`nightowl: ${errorMessage(error)}\n`);
    target.exit(isHook ? 0 : 1);
  };
  target.on('uncaughtException', fail);
  target.on('unhandledRejection', fail);
}

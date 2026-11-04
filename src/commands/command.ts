import type { Io } from '../cli/io.js';

export interface Command {
  readonly name: string;
  readonly summary: string;
  // Full text for `nightowl <name> --help`, ending with a newline.
  readonly help: string;
  readonly run: (args: readonly string[], io: Io) => Promise<number>;
}

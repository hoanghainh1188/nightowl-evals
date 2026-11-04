import type { Io } from '../cli/io.js';

export interface Command {
  readonly name: string;
  readonly summary: string;
  readonly run: (args: readonly string[], io: Io) => Promise<number>;
}

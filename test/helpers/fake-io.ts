import type { Io } from '../../src/cli/io.js';

export interface FakeIoOptions {
  readonly stdin?: string;
  readonly isTTY?: boolean;
  readonly readError?: Error;
  // Simulate the stdin timeout firing before EOF.
  readonly timedOut?: boolean;
}

export interface FakeIo {
  readonly io: Io;
  readonly out: () => string;
  readonly err: () => string;
  readonly stdinReads: () => number;
  readonly stdinTimeouts: () => readonly (number | undefined)[];
}

export function createFakeIo(options: FakeIoOptions = {}): FakeIo {
  const outChunks: string[] = [];
  const errChunks: string[] = [];
  let reads = 0;
  const timeouts: (number | undefined)[] = [];

  const io: Io = {
    stdout: (text) => {
      outChunks.push(text);
    },
    stderr: (text) => {
      errChunks.push(text);
    },
    stdin: {
      isTTY: options.isTTY ?? false,
      readAll: async (timeoutMs) => {
        reads += 1;
        timeouts.push(timeoutMs);
        if (options.readError) throw options.readError;
        return { text: options.stdin ?? '', complete: !options.timedOut };
      },
    },
  };

  return {
    io,
    out: () => outChunks.join(''),
    err: () => errChunks.join(''),
    stdinReads: () => reads,
    stdinTimeouts: () => [...timeouts],
  };
}

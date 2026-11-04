export interface StdinRead {
  readonly text: string;
  // False when the timeout fired before EOF, so `text` may be cut short.
  readonly complete: boolean;
}

export interface StdinSource {
  readonly isTTY: boolean;
  readonly readAll: (timeoutMs?: number) => Promise<StdinRead>;
}

export interface Io {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
  readonly stdin: StdinSource;
}

type ReadableSource = NodeJS.ReadableStream & { destroy?: () => void };

export function readStream(stream: ReadableSource, timeoutMs?: number): Promise<StdinRead> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const finish = (complete: boolean) => {
      if (timer) clearTimeout(timer);
      stream.removeListener('data', onData);
      resolve({ text: Buffer.concat(chunks).toString('utf8'), complete });
    };
    const onData = (chunk: string | Buffer) => {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    };
    const timer =
      timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
            stream.destroy?.();
            finish(false);
          }, timeoutMs);
    timer?.unref();

    stream.on('data', onData);
    stream.once('end', () => finish(true));
    stream.once('error', (error) => {
      if (timer) clearTimeout(timer);
      reject(error);
    });
  });
}

export function processIo(): Io {
  return {
    stdout: (text) => {
      process.stdout.write(text);
    },
    stderr: (text) => {
      process.stderr.write(text);
    },
    stdin: {
      isTTY: process.stdin.isTTY === true,
      readAll: (timeoutMs) => readStream(process.stdin, timeoutMs),
    },
  };
}

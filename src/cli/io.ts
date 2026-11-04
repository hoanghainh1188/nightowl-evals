export interface StdinSource {
  readonly isTTY: boolean;
  // Resolves with what was read so far once `timeoutMs` passes without EOF.
  readonly readAll: (timeoutMs?: number) => Promise<string>;
}

export interface Io {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
  readonly stdin: StdinSource;
}

type ReadableSource = NodeJS.ReadableStream & { destroy?: () => void };

export function readStream(stream: ReadableSource, timeoutMs?: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const finish = () => {
      if (timer) clearTimeout(timer);
      stream.removeListener('data', onData);
      resolve(Buffer.concat(chunks).toString('utf8'));
    };
    const onData = (chunk: string | Buffer) => {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    };
    const timer =
      timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
            stream.destroy?.();
            finish();
          }, timeoutMs);
    timer?.unref();

    stream.on('data', onData);
    stream.once('end', finish);
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

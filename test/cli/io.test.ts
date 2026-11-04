import { PassThrough, Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { processIo, readStream } from '../../src/cli/io.js';

describe('readStream', () => {
  it('joins string and buffer chunks as UTF-8', async () => {
    const stream = Readable.from(['{"a":', Buffer.from('"đúng"}')]);
    expect(await readStream(stream)).toBe('{"a":"đúng"}');
  });

  it('returns an empty string for an empty stream', async () => {
    expect(await readStream(Readable.from([]))).toBe('');
  });

  it('resolves with partial input and destroys the stream when it never ends', async () => {
    const stream = new PassThrough();
    stream.write('{"partial":');
    const started = Date.now();
    const text = await readStream(stream, 50);
    expect(text).toBe('{"partial":');
    expect(Date.now() - started).toBeLessThan(500);
    expect(stream.destroyed).toBe(true);
  });

  it('finishes before the timeout when the stream ends in time', async () => {
    const stream = new PassThrough();
    stream.end('done');
    expect(await readStream(stream, 5_000)).toBe('done');
  });

  it('rejects when the stream errors', async () => {
    const stream = new PassThrough();
    const pending = readStream(stream, 5_000);
    stream.destroy(new Error('EIO'));
    await expect(pending).rejects.toThrow('EIO');
  });
});

describe('processIo', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes to the process stdout and stderr', () => {
    const out = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const err = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const io = processIo();
    io.stdout('hello\n');
    io.stderr('oops\n');
    expect(out).toHaveBeenCalledWith('hello\n');
    expect(err).toHaveBeenCalledWith('oops\n');
  });

  it('reports whether stdin is a terminal', () => {
    expect(processIo().stdin.isTTY).toBe(process.stdin.isTTY === true);
  });
});

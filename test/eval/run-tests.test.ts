import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runShellCommand, withSwappedFile } from '../../src/eval/run-tests.js';
import { createTempDir, type TempDir } from '../helpers/temp-repo.js';

describe('withSwappedFile', () => {
  let dir: TempDir;
  beforeEach(async () => {
    dir = await createTempDir();
  });
  afterEach(() => dir.cleanup());

  it('restores previous content after success', async () => {
    const file = join(dir.path, 'src/a.ts');
    await mkdir(join(dir.path, 'src'), { recursive: true });
    await writeFile(file, 'old\n');
    const seen = await withSwappedFile(file, 'new\n', async () => readFile(file, 'utf8'));
    expect(seen).toBe('new\n');
    expect(await readFile(file, 'utf8')).toBe('old\n');
  });

  it('restores previous content after failure', async () => {
    const file = join(dir.path, 'a.ts');
    await writeFile(file, 'keep\n');
    await expect(
      withSwappedFile(file, 'temp\n', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await readFile(file, 'utf8')).toBe('keep\n');
  });

  it('removes a file that did not exist before', async () => {
    const file = join(dir.path, 'missing.ts');
    await withSwappedFile(file, 'only-during\n', async () => {
      expect(await readFile(file, 'utf8')).toBe('only-during\n');
    });
    await expect(readFile(file, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });
});

describe('runShellCommand', () => {
  let dir: TempDir;
  beforeEach(async () => {
    dir = await createTempDir();
  });
  afterEach(() => dir.cleanup());

  it('reports exit 0 as passed', async () => {
    const result = await runShellCommand('exit 0', { cwd: dir.path, timeoutMs: 5_000 });
    expect(result).toEqual({ passed: true, exitCode: 0, error: null });
  });

  it('reports non-zero exit as failed', async () => {
    const result = await runShellCommand('echo fail>&2; exit 2', { cwd: dir.path, timeoutMs: 5_000 });
    expect(result.passed).toBe(false);
    expect(result.exitCode).toBe(2);
    expect(result.error).toContain('fail');
  });

  it('times out and kills the command', async () => {
    const result = await runShellCommand('sleep 30', { cwd: dir.path, timeoutMs: 200 });
    expect(result).toEqual({ passed: false, exitCode: null, error: 'test command timed out' });
  }, 10_000);
});

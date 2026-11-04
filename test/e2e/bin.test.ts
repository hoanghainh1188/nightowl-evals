import { execFile, spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { beforeAll, describe, expect, it } from 'vitest';
import pkg from '../../package.json' with { type: 'json' };

const ROOT = join(import.meta.dirname, '../..');
const BIN = join(ROOT, 'dist/bin.js');
const execFileAsync = promisify(execFile);

interface Result {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

interface RunOptions {
  readonly stdin?: string;
  // Leave stdin open forever, like a hook whose pipe is never closed.
  readonly keepStdinOpen?: boolean;
  // Close our end of stdout before the CLI writes, to provoke EPIPE.
  readonly closeStdout?: boolean;
}

function runBin(args: readonly string[], options: RunOptions = {}): Promise<Result> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [BIN, ...args], { cwd: ROOT });
    let stdout = '';
    let stderr = '';
    if (options.closeStdout) child.stdout.destroy();
    else child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    if (options.keepStdinOpen) child.stdin.write('{"partial":');
    else child.stdin.end(options.stdin ?? '');
  });
}

// Includes Node start-up, so it is looser than the in-process timeout checks.
const HOOK_BUDGET_MS = 2_000;

describe('nightowl bin (built)', () => {
  beforeAll(async () => {
    await execFileAsync('npx', ['tsup', '--silent'], { cwd: ROOT });
  }, 60_000);

  it('starts with a node shebang', async () => {
    const text = await readFile(BIN, 'utf8');
    expect(text.startsWith('#!/usr/bin/env node\n')).toBe(true);
  });

  it('prints the version', async () => {
    expect(await runBin(['--version'])).toEqual({ code: 0, stdout: `${pkg.version}\n`, stderr: '' });
  });

  it('prints help listing all commands', async () => {
    const result = await runBin(['--help']);
    expect(result.code).toBe(0);
    for (const name of ['init', 'log', 'report', 'export']) expect(result.stdout).toContain(name);
  });

  it('fails on an unknown command', async () => {
    const result = await runBin(['reprot']);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('reprot');
  });

  it.each([
    ['invalid JSON', 'not json'],
    ['valid JSON', '{"hook_event_name":"PostToolUse"}'],
    ['empty stdin', ''],
  ])('log exits 0 silently for %s', async (_label, input) => {
    const started = Date.now();
    expect(await runBin(['log'], { stdin: input })).toEqual({ code: 0, stdout: '', stderr: '' });
    expect(Date.now() - started).toBeLessThan(HOOK_BUDGET_MS);
  });

  it('log exits 0 silently when stdin is never closed', async () => {
    const started = Date.now();
    expect(await runBin(['log'], { keepStdinOpen: true })).toEqual({ code: 0, stdout: '', stderr: '' });
    expect(Date.now() - started).toBeLessThan(HOOK_BUDGET_MS);
  });

  it('does not crash when stdout is closed early', async () => {
    const result = await runBin(['--help'], { closeStdout: true });
    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
  });
});

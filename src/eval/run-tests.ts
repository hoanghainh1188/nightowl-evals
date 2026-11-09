import { spawn } from 'node:child_process';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { killProcessTree } from '../classify/run-claude.js';

export const DEFAULT_TEST_TIMEOUT_SEC = 120;
export const MIN_TEST_TIMEOUT_SEC = 1;
export const MAX_TEST_TIMEOUT_SEC = 600;
const MAX_OUTPUT_CHARS = 8 * 1024;

export interface TestRunResult {
  readonly passed: boolean;
  readonly exitCode: number | null;
  readonly error: string | null;
}

export interface RunShellOptions {
  readonly cwd: string;
  readonly timeoutMs: number;
  readonly platform?: NodeJS.Platform;
  readonly env?: NodeJS.ProcessEnv;
}

export type RunShellCommand = (command: string, options: RunShellOptions) => Promise<TestRunResult>;

function truncate(text: string): string {
  if (text.length <= MAX_OUTPUT_CHARS) return text;
  return `${text.slice(0, MAX_OUTPUT_CHARS)}…`;
}

// Swap file content for the duration of `fn`, then restore (or remove if it did not exist).
export async function withSwappedFile<T>(absolutePath: string, content: string, fn: () => Promise<T>): Promise<T> {
  let previous: string | null = null;
  let existed = true;
  try {
    previous = await readFile(absolutePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    existed = false;
  }
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, 'utf8');
  try {
    return await fn();
  } finally {
    if (existed && previous !== null) {
      await writeFile(absolutePath, previous, 'utf8');
    } else {
      await unlink(absolutePath).catch(() => undefined);
    }
  }
}

export const runShellCommand: RunShellCommand = (command, options) =>
  new Promise((resolve) => {
    const platform = options.platform ?? process.platform;
    const isWindows = platform === 'win32';
    const shell = isWindows ? (options.env?.ComSpec ?? process.env.ComSpec ?? 'cmd.exe') : '/bin/sh';
    const args = isWindows ? ['/d', '/s', '/c', command] : ['-c', command];
    const child = spawn(shell, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: !isWindows,
      windowsHide: isWindows,
    });
    const chunks: Buffer[] = [];
    let settled = false;
    const finish = (result: TestRunResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      killProcessTree(child.pid, platform);
      finish({ passed: false, exitCode: null, error: 'test command timed out' });
    }, options.timeoutMs);

    const onData = (chunk: Buffer) => {
      if (chunks.reduce((n, c) => n + c.length, 0) < MAX_OUTPUT_CHARS * 2) chunks.push(chunk);
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', (error: NodeJS.ErrnoException) =>
      finish({
        passed: false,
        exitCode: null,
        error: error.code === 'ENOENT' ? `shell was not found: ${shell}` : truncate(error.message),
      }),
    );
    child.on('close', (code) => {
      const output = truncate(Buffer.concat(chunks).toString('utf8').trim());
      if (code === 0) {
        finish({ passed: true, exitCode: 0, error: null });
        return;
      }
      finish({
        passed: false,
        exitCode: code,
        error: output === '' ? `test command exited with code ${String(code)}` : output,
      });
    });
  });

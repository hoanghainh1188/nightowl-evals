import { execFile, spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pkg from '../../package.json' with { type: 'json' };
import { openStore } from '../../src/storage/store.js';
import { hookFixture } from '../helpers/fixtures.js';
import { createFakeRepo, createTempDir, type TempDir, writeFiles } from '../helpers/temp-repo.js';

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
  // Defaults to a scratch directory outside any repo, so tests never write into this one.
  readonly cwd?: string;
}

let scratch: TempDir;

function runBin(args: readonly string[], options: RunOptions = {}): Promise<Result> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [BIN, ...args], { cwd: options.cwd ?? scratch.path });
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
    scratch = await createTempDir();
    await execFileAsync('npx', ['tsup', '--silent'], { cwd: ROOT });
  }, 60_000);

  afterAll(() => scratch.cleanup());

  it('keeps the node: prefix on built-in imports', async () => {
    const text = await readFile(BIN, 'utf8');
    expect(text).toContain('"node:sqlite"');
    expect(text).not.toMatch(/from\s+"sqlite"|import\("sqlite"\)/);
  });

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

  describe('in a project', () => {
    let repo: TempDir;

    beforeAll(async () => {
      repo = await createFakeRepo();
      await writeFiles(repo.path, { 'src/a.ts': 'export const a = 2;\n' });
    });

    afterAll(() => repo.cleanup());

    it('init sets the project up', async () => {
      const result = await runBin(['init'], { cwd: repo.path });
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('.claude/settings.json');
      expect(result.stderr).not.toContain('ExperimentalWarning');
    });

    it('log stores hook events silently', async () => {
      for (const name of ['user-prompt-submit', 'post-tool-use-edit', 'post-tool-use-bash'] as const) {
        expect(await runBin(['log'], { cwd: repo.path, stdin: hookFixture(name, repo.path) })).toEqual({
          code: 0,
          stdout: '',
          stderr: '',
        });
      }
      const store = await openStore({ cwd: repo.path });
      try {
        expect(store.listEvents().map((event) => event.kind)).toEqual(['prompt', 'edit']);
      } finally {
        store.close();
      }
    });

    it('log handles a 1 MB Write payload within a second', async () => {
      const big = 'x'.repeat(1024 * 1024);
      await writeFile(`${repo.path}/big.txt`, big);
      const payload = JSON.stringify({
        session_id: 's2',
        cwd: repo.path,
        hook_event_name: 'PostToolUse',
        tool_name: 'Write',
        tool_input: { file_path: `${repo.path}/big.txt`, content: big },
        tool_response: {},
      });
      const started = Date.now();
      expect(await runBin(['log'], { cwd: repo.path, stdin: payload })).toEqual({ code: 0, stdout: '', stderr: '' });
      expect(Date.now() - started).toBeLessThan(HOOK_BUDGET_MS);
    });
  });
});

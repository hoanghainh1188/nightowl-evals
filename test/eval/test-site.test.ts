import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RunShellCommand, TestRunResult } from '../../src/eval/run-tests.js';
import { createTestSite, type TestSiteConfig, type WorktreeDeps } from '../../src/eval/test-site.js';
import { createTempDir, type TempDir } from '../helpers/temp-repo.js';

const OK: TestRunResult = { passed: true, exitCode: 0, error: null };
const SHA = 'abcdef1234567';
const BASE = '1111111111111111111111111111111111111111';

describe('createTestSite', () => {
  let root: TempDir;
  let checkout: TempDir;
  let shell: Array<{ command: string; cwd: string; timeoutMs: number; seen: string | null }>;
  let opened: string[];
  let disposed: number;

  beforeEach(async () => {
    root = await createTempDir();
    checkout = await createTempDir();
    shell = [];
    opened = [];
    disposed = 0;
    await mkdir(join(root.path, 'src'));
    await writeFile(join(root.path, 'src/a.ts'), 'root\n');
  });
  afterEach(async () => {
    await root.cleanup();
    await checkout.cleanup();
  });

  // Records the content of src/a.ts in the command's cwd at the time it runs.
  function runShell(results: Record<string, TestRunResult> = {}): RunShellCommand {
    return async (command, options) => {
      const seen = await readFile(join(options.cwd, 'src/a.ts'), 'utf8').catch(() => null);
      shell.push({ command, cwd: options.cwd, timeoutMs: options.timeoutMs, seen });
      return results[command] ?? OK;
    };
  }

  function worktrees(overrides: Partial<WorktreeDeps> = {}): WorktreeDeps {
    return {
      resolveParent: async (_root, sha) => (sha === SHA ? BASE : null),
      open: async (_root, base) => {
        opened.push(base);
        return { dir: checkout.path, dispose: async () => void (disposed += 1) };
      },
      cleanStale: async () => undefined,
      ...overrides,
    };
  }

  const config = (overrides: Partial<TestSiteConfig> = {}): TestSiteConfig => ({
    isolation: 'worktree',
    testCommand: 'npm test',
    setupCommand: null,
    timeoutMs: 5_000,
    ...overrides,
  });

  it('in place: swaps the project file, runs at the root, restores it', async () => {
    const site = createTestSite(root.path, SHA, config({ isolation: 'in-place' }), runShell(), worktrees());
    expect(await site.runTests('src/a.ts', 'model\n')).toEqual(OK);
    await site.dispose();
    expect(shell).toEqual([{ command: 'npm test', cwd: root.path, timeoutMs: 5_000, seen: 'model\n' }]);
    expect(await readFile(join(root.path, 'src/a.ts'), 'utf8')).toBe('root\n');
    expect(opened).toEqual([]);
  });

  it('worktree: checks out the parent once, sets up once, and never writes the project file', async () => {
    const site = createTestSite(root.path, SHA, config({ setupCommand: 'npm ci' }), runShell(), worktrees());
    expect(await site.runTests('src/a.ts', 'first\n')).toEqual(OK);
    expect(await site.runTests('src/a.ts', 'second\n')).toEqual(OK);
    await site.dispose();
    expect(opened).toEqual([BASE]);
    expect(shell).toEqual([
      { command: 'npm ci', cwd: checkout.path, timeoutMs: 5_000, seen: null },
      { command: 'npm test', cwd: checkout.path, timeoutMs: 5_000, seen: 'first\n' },
      { command: 'npm test', cwd: checkout.path, timeoutMs: 5_000, seen: 'second\n' },
    ]);
    expect(await readFile(join(root.path, 'src/a.ts'), 'utf8')).toBe('root\n');
    expect(disposed).toBe(1);
  });

  it('worktree without a commit: no test runs and the reason is recorded', async () => {
    const site = createTestSite(root.path, null, config(), runShell(), worktrees());
    expect(await site.runTests('src/a.ts', 'x\n')).toEqual({
      passed: null,
      exitCode: null,
      error: 'no base commit for worktree',
    });
    expect(shell).toEqual([]);
    expect(opened).toEqual([]);
  });

  it('worktree with a commit that has no parent here', async () => {
    const site = createTestSite(root.path, 'fedcba9876543', config(), runShell(), worktrees());
    expect(await site.runTests('src/a.ts', 'x\n')).toEqual({
      passed: null,
      exitCode: null,
      error: 'cannot resolve parent of fedcba987654',
    });
  });

  it('a checkout that fails is reported once and not retried', async () => {
    let tries = 0;
    const failing = worktrees({
      open: async () => {
        tries += 1;
        throw new Error('worktree: cannot check out 111111111111');
      },
    });
    const site = createTestSite(root.path, SHA, config(), runShell(), failing);
    const expected = { passed: false, exitCode: null, error: 'worktree: cannot check out 111111111111' };
    expect(await site.runTests('src/a.ts', 'x\n')).toEqual(expected);
    expect(await site.runTests('src/a.ts', 'y\n')).toEqual(expected);
    expect(tries).toBe(1);
    expect(shell).toEqual([]);
  });

  it('a failing setup fails every model of the case without running tests', async () => {
    const site = createTestSite(
      root.path,
      SHA,
      config({ setupCommand: 'npm ci' }),
      runShell({ 'npm ci': { passed: false, exitCode: 2, error: null } }),
      worktrees(),
    );
    const expected = { passed: false, exitCode: 2, error: 'setup failed: exit code 2' };
    expect(await site.runTests('src/a.ts', 'x\n')).toEqual(expected);
    expect(await site.runTests('src/a.ts', 'y\n')).toEqual(expected);
    expect(shell.map((call) => call.command)).toEqual(['npm ci']);
  });

  it('a setup timeout keeps its reason', async () => {
    const site = createTestSite(
      root.path,
      SHA,
      config({ setupCommand: 'npm ci' }),
      runShell({ 'npm ci': { passed: false, exitCode: null, error: 'timed out after 5s' } }),
      worktrees(),
    );
    expect((await site.runTests('src/a.ts', 'x\n')).error).toBe('setup failed: timed out after 5s');
  });

  it.each(['../outside.ts', '/etc/passwd'])('refuses a file path outside the checkout: %s', async (path) => {
    const site = createTestSite(root.path, SHA, config(), runShell(), worktrees());
    expect(await site.runTests(path, 'x\n')).toEqual({
      passed: false,
      exitCode: null,
      error: 'file path is outside the checkout',
    });
    expect(shell.filter((call) => call.command === 'npm test')).toEqual([]);
  });

  it('dispose without any test run opens nothing', async () => {
    const site = createTestSite(root.path, SHA, config(), runShell(), worktrees());
    await site.dispose();
    expect(opened).toEqual([]);
    expect(disposed).toBe(0);
  });
});

import { isAbsolute, relative, resolve } from 'node:path';
import { type RunShellCommand, withSwappedFile } from './run-tests.js';
import { type CaseWorktree, cleanStaleWorktrees, type OpenCaseWorktree, openCaseWorktree, resolveParentCommit } from './worktree.js';

export const ISOLATION_MODES = Object.freeze(['worktree', 'in-place'] as const);
export type Isolation = (typeof ISOLATION_MODES)[number];

// `passed` is null when the tests could not be run at all for a reason that says nothing about
// the model's answer (no commit to check out).
export interface TestsOutcome {
  readonly passed: boolean | null;
  readonly exitCode: number | null;
  readonly error: string | null;
}

export interface TestSiteConfig {
  readonly isolation: Isolation;
  readonly testCommand: string;
  readonly setupCommand: string | null;
  readonly timeoutMs: number;
}

export interface WorktreeDeps {
  readonly resolveParent: (root: string, commitSha: string | null) => Promise<string | null>;
  readonly open: OpenCaseWorktree;
  readonly cleanStale: (root: string) => Promise<void>;
}

export const defaultWorktreeDeps: WorktreeDeps = Object.freeze({
  resolveParent: resolveParentCommit,
  open: openCaseWorktree,
  cleanStale: cleanStaleWorktrees,
});

// Where one case's tests run, shared by every model of that case.
export interface TestSite {
  readonly runTests: (filePath: string, content: string) => Promise<TestsOutcome>;
  readonly dispose: () => Promise<void>;
}

type Checkout = { readonly ok: true; readonly dir: string } | { readonly ok: false; readonly outcome: TestsOutcome };

const fail = (passed: boolean | null, error: string, exitCode: number | null = null): Checkout => ({
  ok: false,
  outcome: { passed, exitCode, error },
});

// A file path from the suite, resolved inside `dir`; null when it would land outside.
function insideDir(dir: string, filePath: string): string | null {
  if (isAbsolute(filePath)) return null;
  const target = resolve(dir, filePath);
  const rel = relative(dir, target);
  return rel === '' || rel.startsWith('..') || isAbsolute(rel) ? null : target;
}

function setupError(result: { readonly exitCode: number | null; readonly error: string | null }): string {
  return `setup failed: ${result.error ?? `exit code ${String(result.exitCode)}`}`;
}

export function createTestSite(
  root: string,
  commitSha: string | null,
  config: TestSiteConfig,
  runShell: RunShellCommand,
  worktrees: WorktreeDeps,
): TestSite {
  let worktree: CaseWorktree | null = null;
  let checkout: Promise<Checkout> | null = null;

  const prepare = async (): Promise<Checkout> => {
    if (config.isolation === 'in-place') return { ok: true, dir: root };
    if (commitSha === null) return fail(null, 'no base commit for worktree');
    const base = await worktrees.resolveParent(root, commitSha);
    if (base === null) return fail(null, `cannot resolve parent of ${commitSha.slice(0, 12)}`);
    try {
      worktree = await worktrees.open(root, base);
    } catch (error) {
      return fail(false, error instanceof Error ? error.message : String(error));
    }
    if (config.setupCommand !== null) {
      const setup = await runShell(config.setupCommand, { cwd: worktree.dir, timeoutMs: config.timeoutMs });
      if (!setup.passed) return fail(false, setupError(setup), setup.exitCode);
    }
    return { ok: true, dir: worktree.dir };
  };

  return Object.freeze({
    runTests: async (filePath: string, content: string): Promise<TestsOutcome> => {
      checkout ??= prepare();
      const site = await checkout;
      if (!site.ok) return site.outcome;
      const target = insideDir(site.dir, filePath);
      if (target === null) return { passed: false, exitCode: null, error: 'file path is outside the checkout' };
      return withSwappedFile(target, content, () => runShell(config.testCommand, { cwd: site.dir, timeoutMs: config.timeoutMs }));
    },
    dispose: async (): Promise<void> => {
      await checkout?.catch(() => undefined);
      await worktree?.dispose();
    },
  });
}

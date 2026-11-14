import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ClaudeError } from '../../src/classify/run-claude.js';
import { createEvalCommand, type EvalDeps } from '../../src/commands/eval.js';
import type { TestRunResult } from '../../src/eval/run-tests.js';
import { createFakeIo } from '../helpers/fake-io.js';
import type { WorktreeDeps } from '../../src/eval/test-site.js';
import { createFakeRepo, createTempDir, type TempDir } from '../helpers/temp-repo.js';

const evalLine = (id: string, overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    schema: 'nightowl.eval/v1',
    id,
    file_path: 'src/age.ts',
    input: { prompt: 'isAdult is true from 18', file_before: 'export const isAdult = (age) => false;\n' },
    rejected: 'export const isAdult = (age) => age > 18;\n',
    expected: 'export const isAdult = (age) => age >= 18;\n',
    ...overrides,
  });

const answer = (content: string) => JSON.stringify({ type: 'result', structured_output: { content } });
const GOOD = answer('export const isAdult = (age) => age >= 18;\n');
const BAD = answer('export const isAdult = (age) => age > 18;\n');

describe('nightowl eval', () => {
  let repo: TempDir;
  let calls: Array<{ model: string; prompt: string; timeoutMs: number | undefined; schema: object }>;
  let shellCalls: Array<{ command: string; cwd: string; timeoutMs: number }>;
  let worktreeLog: string[];
  let checkout: TempDir;

  beforeEach(async () => {
    repo = await createFakeRepo();
    calls = [];
    shellCalls = [];
    worktreeLog = [];
    checkout = await createTempDir();
  });
  afterEach(async () => {
    await repo.cleanup();
    await checkout.cleanup();
  });

  // Every commit sha has parent `base-of-<sha>`; checkouts land in `checkout`.
  function fakeWorktrees(overrides: Partial<WorktreeDeps> = {}): WorktreeDeps {
    return {
      resolveParent: async (_root, sha) => (sha === null ? null : `base-of-${sha}`),
      open: async (_root, base) => {
        worktreeLog.push(`open ${base}`);
        return { dir: checkout.path, dispose: async () => void worktreeLog.push(`dispose ${base}`) };
      },
      cleanStale: async () => void worktreeLog.push('clean'),
      ...overrides,
    };
  }

  async function writeSuite(lines: readonly string[], file = '.nightowl/export/evals.jsonl'): Promise<void> {
    await mkdir(join(repo.path, file, '..'), { recursive: true });
    await writeFile(join(repo.path, file), lines.map((l) => `${l}\n`).join(''));
  }

  // Answers per model; an Error is thrown for that call.
  function deps(
    byModel: Record<string, ReadonlyArray<string | Error>>,
    overrides: Partial<EvalDeps> = {},
    shell: TestRunResult | ((command: string) => TestRunResult | Promise<TestRunResult>) = {
      passed: true,
      exitCode: 0,
      error: null,
    },
  ): EvalDeps {
    const seen = new Map<string, number>();
    return {
      cwd: () => repo.path,
      isOnPath: () => true,
      now: () => new Date('2026-11-10T09:30:00.000Z'),
      runClaude: async (prompt, options) => {
        calls.push({ model: options.model, prompt, timeoutMs: options.timeoutMs, schema: options.schema });
        const list = byModel[options.model] ?? [GOOD];
        const n = seen.get(options.model) ?? 0;
        seen.set(options.model, n + 1);
        const response = list[n % list.length] as string | Error;
        if (response instanceof Error) throw response;
        return response;
      },
      runShell: async (command, options) => {
        shellCalls.push({ command, cwd: options.cwd, timeoutMs: options.timeoutMs });
        return typeof shell === 'function' ? shell(command) : shell;
      },
      worktrees: fakeWorktrees(),
      ...overrides,
    };
  }

  async function run(args: readonly string[], d: EvalDeps) {
    const fake = createFakeIo();
    const code = await createEvalCommand(d).run(args, fake.io);
    return { code, out: fake.out(), err: fake.err() };
  }

  const runsDir = () => join(repo.path, '.nightowl/runs');

  describe('without --yes', () => {
    it('says what would be sent, sends nothing and writes nothing', async () => {
      await writeSuite([evalLine('a'), evalLine('b'), evalLine('c', { input: { prompt: null, file_before: null } }), '{bad']);
      const result = await run([], deps({}));
      expect(result.code).toBe(0);
      expect(result.out).toContain('Would run 2 cases × 2 models (haiku, sonnet) = 4 calls');
      expect(result.out).toContain('skipped: 1 without prompt, 1 invalid lines');
      expect(result.out).toContain('Files whose content would be sent:\n  src/age.ts\n');
      expect(result.out).toContain('nightowl eval --yes\n');
      expect(calls).toEqual([]);
      expect(await readdir(join(repo.path, '.nightowl'))).not.toContain('runs');
    });

    it('carries the chosen options into the command to run for real', async () => {
      await writeSuite([evalLine('a')], 'suite.jsonl');
      const result = await run(['--input', 'suite.jsonl', '--model', 'opus', '--limit', '5'], deps({}));
      expect(result.out).toContain('nightowl eval --yes --input suite.jsonl --model opus --limit 5');
      expect(result.out).toContain('1 cases × 1 models (opus) = 1 calls');
    });
  });

  describe('with --yes', () => {
    it('runs every case with every model, compares them and saves the results', async () => {
      await writeSuite([evalLine('a'), evalLine('b'), evalLine('c')]);
      const result = await run(['--yes'], deps({ haiku: [GOOD, BAD, BAD], sonnet: [GOOD] }));
      expect(result.code).toBe(0);
      expect(calls.map((c) => c.model)).toEqual(['haiku', 'sonnet', 'haiku', 'sonnet', 'haiku', 'sonnet']);
      expect(calls[0]?.timeoutMs).toBe(180_000);
      expect(calls[0]?.schema).toMatchObject({ required: ['content'] });
      expect(calls[0]?.prompt).toContain('isAdult is true from 18');
      expect(result.out).toMatch(/^ {2}haiku +3 +1 +0\.33 +0$/m);
      expect(result.out).toMatch(/^ {2}sonnet +3 +3 +1\.00 +0$/m);
      expect(result.out).toContain('Different results (2):');
      expect(result.out).toContain('  b: passed by sonnet; not by haiku');
      expect(result.out).toMatch(/Results saved to \.nightowl\/runs\/2026-11-10T09-30-00-000Z-[0-9a-f]{6}\.jsonl/);
      expect(result.err).toContain('Next:');
      expect(result.err).toContain('eval-compare');
      expect(result.err).toMatch(/digest|dashboard/);

      const [name] = await readdir(runsDir());
      const file = join(runsDir(), name as string);
      const rows = (await readFile(file, 'utf8')).trim().split('\n').map((l) => JSON.parse(l));
      expect(rows).toHaveLength(7);
      expect(rows[0]).toMatchObject({ schema: 'nightowl.eval-run-meta/v1', label: null, models: ['haiku', 'sonnet'] });
      expect(rows[1]).toEqual({
        run_at: '2026-11-10T09:30:00.000Z',
        case_id: 'a',
        model: 'haiku',
        output: 'export const isAdult = (age) => age >= 18;\n',
        coverage: 1,
        repeat: 0,
        score: 1,
        pass: true,
        tests_passed: null,
        tests_exit_code: null,
        tests_error: null,
        error: null,
      });
      expect(shellCalls).toEqual([]);
      expect((await stat(file)).mode & 0o777).toBe(0o600);
      expect((await stat(runsDir())).mode & 0o777).toBe(0o700);
    });

    it('records failed calls, keeps going and exits 1', async () => {
      await writeSuite([evalLine('a'), evalLine('b')]);
      const result = await run(
        ['--yes', '--model', 'haiku'],
        deps({ haiku: [new ClaudeError('claude did not answer in time', 'timeout'), answer('x')] }),
      );
      expect(result.code).toBe(1);
      expect(result.err).toContain('a with haiku: claude did not answer in time');
      expect(result.out).toMatch(/^ {2}haiku +1 +0 +0\.00 +1$/m);
      const [file] = await readdir(runsDir());
      const rows = (await readFile(join(runsDir(), file as string), 'utf8')).trim().split('\n').map((l) => JSON.parse(l));
      expect(rows[1]).toMatchObject({ case_id: 'a', output: null, score: null, error: 'claude did not answer in time' });
    });

    it('tags runs with --label and writes --report html', async () => {
      await writeSuite([evalLine('a')]);
      const out = join(repo.path, '.nightowl', 'eval-report.html');
      const result = await run(
        ['--yes', '--model', 'haiku', '--label', 'rules-v2', '--report', 'html', '-o', out],
        deps({ haiku: [GOOD] }),
      );
      expect(result.code).toBe(0);
      const [name] = await readdir(runsDir());
      const meta = JSON.parse((await readFile(join(runsDir(), name as string), 'utf8')).split('\n')[0]!);
      expect(meta).toMatchObject({ schema: 'nightowl.eval-run-meta/v1', label: 'rules-v2' });
      const html = await readFile(out, 'utf8');
      expect(html).toContain('rules-v2');
      expect(html).not.toMatch(/https?:\/\//);
    });

    it('dry-run mentions --report without calling models', async () => {
      await writeSuite([evalLine('a')]);
      const result = await run(['--report', 'md', '--label', 'exp1'], deps({}));
      expect(result.code).toBe(0);
      expect(result.out).toContain('Would tag the run with label exp1');
      expect(result.out).toContain('Would also write an A/B md report');
      expect(calls).toEqual([]);
    });

    it('does not call a failed call a fail when comparing models', async () => {
      await writeSuite([evalLine('a'), evalLine('b')]);
      const result = await run(['--yes'], deps({ haiku: [new ClaudeError('claude exited with code 1', 'exit'), BAD], sonnet: [GOOD] }));
      expect(result.out).not.toContain('  a: passed');
      expect(result.out).toContain('Different results (1):\n  b: passed by sonnet; not by haiku');
    });

    it('stops before any call when the results folder cannot be prepared', async () => {
      await writeSuite([evalLine('a')]);
      await writeFile(join(repo.path, '.nightowl/runs'), 'not a folder');
      const result = await run(['--yes'], deps({}));
      expect(result.code).toBe(1);
      expect(result.err).toContain('cannot prepare .nightowl/runs');
      expect(calls).toEqual([]);
    });

    it('creates .nightowl/ privately for a suite read from elsewhere', async () => {
      const elsewhere = await createTempDir();
      try {
        await writeFile(join(elsewhere.path, 'suite.jsonl'), `${evalLine('a')}\n`);
        const result = await run(['--yes', '--model', 'haiku', '--input', join(elsewhere.path, 'suite.jsonl')], deps({}));
        expect(result.code).toBe(0);
        expect((await stat(join(repo.path, '.nightowl'))).mode & 0o777).toBe(0o700);
        expect(await readdir(runsDir())).toHaveLength(1);
      } finally {
        await elsewhere.cleanup();
      }
    });

    it('counts an answer without content as a failed call, not as a zero score', async () => {
      await writeSuite([evalLine('a')]);
      const result = await run(['--yes', '--model', 'haiku'], deps({ haiku: [JSON.stringify({ structured_output: {} })] }));
      expect(result.code).toBe(1);
      expect(result.out).toMatch(/^ {2}haiku +0 +0 +n\/a +1$/m);
    });

    it('takes at most --limit cases, in file order', async () => {
      await writeSuite([evalLine('a'), evalLine('b'), evalLine('c')]);
      await run(['--yes', '--limit', '2', '--model', 'haiku'], deps({}));
      expect(calls).toHaveLength(2);
    });

    it('fails before reading anything when claude is not installed', async () => {
      await writeSuite([evalLine('a')]);
      const result = await run(['--yes'], deps({}, { isOnPath: () => false }));
      expect(result.code).toBe(1);
      expect(result.err).toMatch(/'claude' was not found/);
      expect(calls).toEqual([]);
      expect(await readdir(join(repo.path, '.nightowl'))).not.toContain('runs');
    });
  });

  it('asks for nightowl export when there is no suite', async () => {
    const result = await run([], deps({}));
    expect(result.code).toBe(1);
    expect(result.err).toContain("Run 'nightowl export' first");
  });

  it('quotes an odd --input path in the hint', async () => {
    await writeSuite([evalLine('a')], 'my suite.jsonl');
    expect((await run(['--input', 'my suite.jsonl'], deps({}))).out).toContain("--input 'my suite.jsonl'");
  });

  it('runs each id once', async () => {
    await writeSuite([evalLine('a'), evalLine('a')]);
    const result = await run([], deps({}));
    expect(result.out).toContain('Would run 1 cases');
    expect(result.out).toContain('1 duplicate ids');
  });

  it('says so when no case can run', async () => {
    await writeSuite([evalLine('a', { input: { prompt: null, file_before: null } })]);
    expect(await run([], deps({}))).toEqual({ code: 0, out: 'No runnable cases in the suite (skipped: 1 without prompt).\n', err: '' });
  });

  it.each([
    [['--limit', '0']],
    [['--limit', '101']],
    [['--model', '-x']],
    [['--input', '']],
    [['--weird']],
    [['extra']],
    [['--test-command', '']],
    [['--test-command', 'npm test', '--isolation', 'docker']],
    [['--test-command', 'npm test', '--setup-command', '']],
    [['--setup-command', 'npm ci']],
    [['--test-command', 'npm test', '--isolation', 'in-place', '--setup-command', 'npm ci']],
    [['--test-timeout', '0']],
    [['--test-timeout', '601']],
    [['--require-tests']],
    [['--yes', '--require-tests']],
  ])('rejects %j', async (args) => {
    await writeSuite([evalLine('a')]);
    const result = await run(args, deps({}));
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/^nightowl eval: /);
    expect(calls).toEqual([]);
    expect(shellCalls).toEqual([]);
  });

  describe('test command', () => {
    it('dry-run says tests run in a worktree, with the setup command', async () => {
      await writeSuite([evalLine('a')]);
      const result = await run(['--test-command', 'npm test', '--setup-command', 'npm ci'], deps({}));
      expect(result.code).toBe(0);
      expect(result.out).toContain("in a git worktree at the parent of each case's commit (.nightowl/worktrees/) after npm ci");
      expect(result.out).toContain("--test-command 'npm test' --setup-command 'npm ci'");
      expect(worktreeLog).toEqual([]);
      expect(shellCalls).toEqual([]);
    });

    it('dry-run in place keeps the project-root wording and the flag in the hint', async () => {
      await writeSuite([evalLine('a')]);
      const result = await run(['--test-command', 'npm test', '--isolation', 'in-place'], deps({}));
      expect(result.out).toContain('would run npm test in the project root');
      expect(result.out).toContain('--isolation in-place');
    });

    it('by default tests each case in its own worktree, shared by the models, and never writes the project file', async () => {
      await writeSuite([evalLine('a', { commit_sha: 'abcdef1234567' }), evalLine('b', { commit_sha: '7654321fedcba' })]);
      await mkdir(join(repo.path, 'src'), { recursive: true });
      await writeFile(join(repo.path, 'src/age.ts'), 'mine\n');
      const seen: string[] = [];
      const result = await run(
        ['--yes', '--model', 'haiku', '--model', 'sonnet', '--test-command', 'npm test', '--setup-command', 'npm ci'],
        deps({}, {}, async (command) => {
          if (command === 'npm test') seen.push(await readFile(join(checkout.path, 'src/age.ts'), 'utf8'));
          expect(await readFile(join(repo.path, 'src/age.ts'), 'utf8')).toBe('mine\n');
          return { passed: true, exitCode: 0, error: null };
        }),
      );
      expect(result.code).toBe(0);
      expect(worktreeLog).toEqual([
        'clean',
        'open base-of-abcdef1234567',
        'dispose base-of-abcdef1234567',
        'open base-of-7654321fedcba',
        'dispose base-of-7654321fedcba',
      ]);
      expect(shellCalls.map((c) => `${c.command}@${c.cwd === checkout.path ? 'worktree' : c.cwd}`)).toEqual([
        'npm ci@worktree',
        'npm test@worktree',
        'npm test@worktree',
        'npm ci@worktree',
        'npm test@worktree',
        'npm test@worktree',
      ]);
      expect(seen).toEqual(Array(4).fill('export const isAdult = (age) => age >= 18;\n'));
      expect(await readFile(join(repo.path, 'src/age.ts'), 'utf8')).toBe('mine\n');
    });

    it('a case without a commit is not tested and fails --require-tests', async () => {
      await writeSuite([evalLine('a')]);
      const result = await run(
        ['--yes', '--model', 'haiku', '--test-command', 'npm test', '--require-tests'],
        deps({ haiku: [GOOD] }),
      );
      expect(result.code).toBe(0);
      expect(shellCalls).toEqual([]);
      const name = (await readdir(runsDir())).find((f) => f.endsWith('.jsonl'));
      const parsed = (await readFile(join(runsDir(), name as string), 'utf8'))
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as Record<string, unknown>);
      expect(parsed[1]).toMatchObject({
        score: 1,
        pass: false,
        tests_passed: null,
        tests_exit_code: null,
        tests_error: 'no base commit for worktree',
      });
    });

    it('keeps going when stale worktrees or a finished worktree cannot be removed', async () => {
      await writeSuite([evalLine('a', { commit_sha: 'abcdef1234567' })]);
      const worktrees = fakeWorktrees({
        cleanStale: async () => {
          throw new Error('busy');
        },
        open: async () => ({
          dir: checkout.path,
          dispose: async () => {
            throw new Error('locked');
          },
        }),
      });
      const result = await run(['--yes', '--model', 'haiku', '--test-command', 'npm test'], deps({}, { worktrees }));
      expect(result.code).toBe(0);
      expect(result.err).toContain('could not clean .nightowl/worktrees: busy');
      expect(result.err).toContain('could not remove the worktree of a: locked');
      expect(shellCalls).toHaveLength(1);
    });
    it('dry-run mentions the test command and does not spawn shell', async () => {
      await writeSuite([evalLine('a')]);
      const result = await run(['--test-command', 'npm test', '--test-timeout', '30', '--require-tests'], deps({}));
      expect(result.code).toBe(0);
      expect(result.out).toContain('After each answer, would run npm test');
      expect(result.out).toContain('timeout 30s; pass requires tests');
      expect(result.out).toContain("nightowl eval --yes --test-command 'npm test' --test-timeout 30 --require-tests");
      expect(calls).toEqual([]);
      expect(shellCalls).toEqual([]);
    });

    it('runs the shell command after each answer and records the result', async () => {
      await writeSuite([evalLine('a')]);
      await mkdir(join(repo.path, 'src'), { recursive: true });
      await writeFile(join(repo.path, 'src/age.ts'), 'export const isAdult = (age) => false;\n');
      const result = await run(
        ['--yes', '--model', 'haiku', '--test-command', 'npm test', '--isolation', 'in-place'],
        deps({ haiku: [GOOD] }, {}, { passed: true, exitCode: 0, error: null }),
      );
      expect(result.code).toBe(0);
      expect(shellCalls).toEqual([{ command: 'npm test', cwd: repo.path, timeoutMs: 120_000 }]);
      expect(result.out).toMatch(/tests ok/i);
      expect(await readFile(join(repo.path, 'src/age.ts'), 'utf8')).toBe('export const isAdult = (age) => false;\n');
      const name = (await readdir(runsDir())).find((f) => f.endsWith('.jsonl'));
      const parsed = (await readFile(join(runsDir(), name as string), 'utf8'))
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as Record<string, unknown>);
      expect(parsed[1]).toMatchObject({ tests_passed: true, tests_exit_code: 0, tests_error: null, pass: true });
    });

    it('with --require-tests, textual pass and failing tests become pass false', async () => {
      await writeSuite([evalLine('a')]);
      await mkdir(join(repo.path, 'src'), { recursive: true });
      await writeFile(join(repo.path, 'src/age.ts'), 'keep\n');
      const result = await run(
        ['--yes', '--model', 'haiku', '--test-command', 'npm test', '--require-tests', '--isolation', 'in-place'],
        deps({ haiku: [GOOD] }, {}, { passed: false, exitCode: 1, error: 'failed' }),
      );
      expect(result.code).toBe(0);
      const name = (await readdir(runsDir())).find((f) => f.endsWith('.jsonl'));
      const parsed = (await readFile(join(runsDir(), name as string), 'utf8'))
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as Record<string, unknown>);
      expect(parsed[1]).toMatchObject({
        coverage: 1,
        score: 1,
        pass: false,
        tests_passed: false,
        tests_exit_code: 1,
        tests_error: 'failed',
      });
      expect(await readFile(join(repo.path, 'src/age.ts'), 'utf8')).toBe('keep\n');
    });
  });

  it('fails outside a git repository', async () => {
    const outside = await createTempDir();
    try {
      expect((await run([], deps({}, { cwd: () => outside.path }))).code).toBe(1);
    } finally {
      await outside.cleanup();
    }
  });

  it('documents project eval loop in --help', () => {
    expect(createEvalCommand().help).toMatch(/Project eval loop|eval-compare|digest/i);
    expect(createEvalCommand().help).toMatch(/No cloud ranking/i);
  });
});

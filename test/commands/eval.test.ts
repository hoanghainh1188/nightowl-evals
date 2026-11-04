import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ClaudeError } from '../../src/classify/run-claude.js';
import { createEvalCommand, type EvalDeps } from '../../src/commands/eval.js';
import { createFakeIo } from '../helpers/fake-io.js';
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

  beforeEach(async () => {
    repo = await createFakeRepo();
    calls = [];
  });
  afterEach(() => repo.cleanup());

  async function writeSuite(lines: readonly string[], file = '.nightowl/export/evals.jsonl'): Promise<void> {
    await mkdir(join(repo.path, file, '..'), { recursive: true });
    await writeFile(join(repo.path, file), lines.map((l) => `${l}\n`).join(''));
  }

  // Answers per model; an Error is thrown for that call.
  function deps(byModel: Record<string, ReadonlyArray<string | Error>>, overrides: Partial<EvalDeps> = {}): EvalDeps {
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
      expect(result.out).toContain('Results saved to .nightowl/runs/2026-11-10T09-30-00-000Z.jsonl');

      const file = join(runsDir(), '2026-11-10T09-30-00-000Z.jsonl');
      const rows = (await readFile(file, 'utf8')).trim().split('\n').map((l) => JSON.parse(l));
      expect(rows).toHaveLength(6);
      expect(rows[0]).toEqual({
        run_at: '2026-11-10T09:30:00.000Z',
        case_id: 'a',
        model: 'haiku',
        output: 'export const isAdult = (age) => age >= 18;\n',
        coverage: 1,
        repeat: 0,
        score: 1,
        pass: true,
        error: null,
      });
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
      expect(rows[0]).toMatchObject({ case_id: 'a', output: null, score: null, error: 'claude did not answer in time' });
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

  it('says so when no case can run', async () => {
    await writeSuite([evalLine('a', { input: { prompt: null, file_before: null } })]);
    expect(await run([], deps({}))).toEqual({ code: 0, out: 'No runnable cases in the suite (skipped: 1 without prompt).\n', err: '' });
  });

  it.each([[['--limit', '0']], [['--limit', '101']], [['--model', '-x']], [['--input', '']], [['--weird']], [['extra']]])(
    'rejects %j',
    async (args) => {
      await writeSuite([evalLine('a')]);
      const result = await run(args, deps({}));
      expect(result.code).toBe(1);
      expect(result.err).toMatch(/^nightowl eval: /);
      expect(calls).toEqual([]);
    },
  );

  it('fails outside a git repository', async () => {
    const outside = await createTempDir();
    try {
      expect((await run([], deps({}, { cwd: () => outside.path }))).code).toBe(1);
    } finally {
      await outside.cleanup();
    }
  });
});

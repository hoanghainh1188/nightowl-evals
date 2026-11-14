import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type ClassifyDeps, createClassifyCommand } from '../../src/commands/classify.js';
import { ClaudeError } from '../../src/classify/run-claude.js';
import { openStore } from '../../src/storage/store.js';
import { createFakeIo } from '../helpers/fake-io.js';
import { createFakeRepo, createTempDir, type TempDir } from '../helpers/temp-repo.js';

const answer = (category: string, confidence = 0.9) =>
  JSON.stringify({ type: 'result', structured_output: { category, reason: `because ${category}`, confidence } });

interface Row {
  id: number;
  category: string | null;
  category_reason: string | null;
  category_confidence: number | null;
  classifier: string | null;
  classified_at: string | null;
}

describe('nightowl classify', () => {
  let repo: TempDir;
  let prompts: string[];
  let models: string[];

  beforeEach(async () => {
    repo = await createFakeRepo();
    prompts = [];
    models = [];
  });
  afterEach(() => repo.cleanup());

  async function addFailures(
    count: number,
    prompt: string | null = 'add email validation',
    contents: { aiContent: string; finalContent: string } = { aiContent: 'ai\n', finalContent: 'dev\n' },
  ): Promise<number[]> {
    const store = await openStore({ cwd: repo.path });
    try {
      const ids: number[] = [];
      for (let i = 0; i < count; i++) {
        const promptId =
          prompt === null ? null : store.insertEvent({ source: 'agent-hook', kind: 'prompt', sessionId: 's', payload: { prompt } }).id;
        const edit = store.insertEvent({ source: 'agent-hook', kind: 'edit', sessionId: 's', filePath: `f${i}.ts`, payload: {} });
        const check = store.insertEvent({ source: 'git', kind: 'commit-check', filePath: `f${i}.ts`, payload: {} });
        store.attachChecks('sha', [
          {
            checkId: check.id,
            outcome: 'failure',
            failures: [
              {
                filePath: `f${i}.ts`,
                aiEventId: edit.id,
                promptEventId: promptId,
                aiContent: contents.aiContent,
                finalContent: contents.finalContent,
              },
            ],
          },
        ]);
      }
      return store.listFailuresToClassify(1000, true).map((f) => f.id).slice(-count);
    } finally {
      store.close();
    }
  }

  function rows(): Row[] {
    const db = new DatabaseSync(join(repo.path, '.nightowl/nightowl.db'));
    try {
      return db
        .prepare('SELECT id, category, category_reason, category_confidence, classifier, classified_at FROM failures ORDER BY id')
        .all() as unknown as Row[];
    } finally {
      db.close();
    }
  }

  function deps(responses: ReadonlyArray<string | Error>, overrides: Partial<ClassifyDeps> = {}): ClassifyDeps {
    let call = 0;
    const runner = async (prompt: string, options: { model: string }) => {
      prompts.push(prompt);
      models.push(options.model);
      const response = responses[call++ % responses.length] as string | Error;
      if (response instanceof Error) throw response;
      return response;
    };
    return {
      cwd: () => repo.path,
      isOnPath: () => true,
      env: () => ({}),
      now: () => new Date('2026-11-04T10:00:00.000Z'),
      runClaude: async (prompt, options) => runner(prompt, options),
      runApi: async (prompt, options) => runner(prompt, options),
      ...overrides,
    };
  }

  async function run(args: readonly string[], d: ClassifyDeps) {
    const fake = createFakeIo();
    const code = await createClassifyCommand(d).run(args, fake.io);
    return { code, out: fake.out(), err: fake.err() };
  }

  describe('--offline', () => {
    const whitespace = { aiContent: 'const x = 1;\r\n', finalContent: 'const x = 1;\n' };

    it('writes heuristic categories without --yes and without calling the model', async () => {
      await addFailures(1, null, whitespace);
      const result = await run(['--offline'], deps([answer('logic')]));
      expect(result.code).toBe(0);
      expect(result.out).toContain('Offline classified 1 of 1 failure');
      expect(prompts).toEqual([]);
      expect(rows()[0]).toMatchObject({
        category: 'convention',
        classifier: 'heuristic:whitespace-only',
        classified_at: '2026-11-04T10:00:00.000Z',
      });
      expect(await readdir(join(repo.path, '.nightowl'))).not.toContain('classify.lock');
    });

    it('skips already classified failures unless --redo', async () => {
      await addFailures(1, null, whitespace);
      await run(['--offline'], deps([]));
      const before = rows()[0];
      expect((await run(['--offline'], deps([]))).out).toBe('No failures to classify.\n');
      expect(rows()[0]).toEqual(before);
      await run(['--offline', '--redo'], deps([]));
      expect(rows()[0]?.classifier).toBe('heuristic:whitespace-only');
    });

    it('respects --limit', async () => {
      await addFailures(3, null, whitespace);
      await run(['--offline', '--limit', '2'], deps([]));
      expect(rows().map((row) => row.category)).toEqual(['convention', 'convention', null]);
    });

    it('rejects --offline together with --yes', async () => {
      await addFailures(1, null, whitespace);
      const result = await run(['--offline', '--yes'], deps([answer('logic')]));
      expect(result.code).toBe(1);
      expect(result.err).toContain('use either --offline or --yes');
      expect(prompts).toEqual([]);
      expect(rows()[0]?.category).toBeNull();
    });

    it('leaves unmatched failures unclassified and exits 0', async () => {
      await addFailures(1, null, { aiContent: 'return a - b;\n', finalContent: 'return a + b;\n' });
      const result = await run(['--offline'], deps([]));
      expect(result.code).toBe(0);
      expect(result.out).toContain('Offline classified 0 of 1 failure (1 unmatched)');
      expect(rows()[0]?.category).toBeNull();
    });

    it('needs nightowl init and creates nothing', async () => {
      const result = await run(['--offline'], deps([]));
      expect(result.code).toBe(1);
      expect(result.err).toContain('nightowl init');
      expect(await readdir(repo.path)).toEqual(['.git']);
    });
  });

  it('mentions --offline and that LLM needs --yes in help', () => {
    const help = createClassifyCommand().help;
    expect(help).toContain('--offline');
    expect(help).toMatch(/--yes/);
    expect(help).toMatch(/opt-in|needs --yes|LLM/i);
  });

  describe('without --yes', () => {
    it('lists what would be sent, sends nothing and changes nothing', async () => {
      const ids = await addFailures(5);
      const before = rows();
      const result = await run([], deps([answer('logic')]));
      expect(result.code).toBe(0);
      expect(result.out).toContain('Would send 5 failures');
      expect(result.out).toContain('model haiku');
      for (const [i, id] of ids.entries()) expect(result.out).toContain(`#${id} f${i}.ts (`);
      expect(result.out).toContain('nightowl classify --yes');
      expect(result.out).toMatch(/Nothing was sent/);
      expect(prompts).toEqual([]);
      expect(rows()).toEqual(before);
      expect(await readdir(join(repo.path, '.nightowl'))).not.toContain('classify.lock');
    });

    it('carries the chosen options into the command to run for real', async () => {
      await addFailures(1);
      const result = await run(['--limit', '5', '--model', 'sonnet', '--redo'], deps([answer('logic')]));
      expect(result.out).toContain('nightowl classify --yes --redo --limit 5 --model sonnet');
    });

    it('does not need claude to be installed', async () => {
      await addFailures(1);
      expect((await run([], deps([answer('logic')], { isOnPath: () => false }))).code).toBe(0);
    });
  });

  describe('with --yes', () => {
    it('stores category, reason, confidence, classifier and time, and summarises by category', async () => {
      await addFailures(2);
      const result = await run(['--yes'], deps([answer('logic', 0.8), answer('convention', 0.6)]));
      expect(result).toEqual({ code: 0, out: 'Classified 2 of 2 failures\n  logic: 1\n  convention: 1\n', err: '' });
      expect(rows().map(({ id: _id, ...rest }) => rest)).toEqual([
        {
          category: 'logic',
          category_reason: 'because logic',
          category_confidence: 0.8,
          classifier: 'claude-code:haiku',
          classified_at: '2026-11-04T10:00:00.000Z',
        },
        {
          category: 'convention',
          category_reason: 'because convention',
          category_confidence: 0.6,
          classifier: 'claude-code:haiku',
          classified_at: '2026-11-04T10:00:00.000Z',
        },
      ]);
      expect(prompts[0]).toContain('add email validation');
      expect(prompts[0]).toContain('<ai_version>');
    });

    it('skips failures that already have a category unless --redo', async () => {
      await addFailures(1);
      await run(['--yes'], deps([answer('logic')]));
      expect((await run(['--yes'], deps([answer('convention')]))).out).toBe('No failures to classify.\n');
      expect(prompts).toHaveLength(1);
      await run(['--yes', '--redo'], deps([answer('convention')]));
      expect(rows()[0]?.category).toBe('convention');
    });

    it('takes at most --limit failures, oldest first', async () => {
      const ids = await addFailures(3);
      await run(['--yes', '--limit', '2'], deps([answer('logic')]));
      expect(rows().map((row) => row.category)).toEqual(['logic', 'logic', null]);
      expect(rows().map((row) => row.id)).toEqual(ids);
    });

    it('passes --model to claude and records it', async () => {
      await addFailures(1);
      await run(['--yes', '--model', 'sonnet'], deps([answer('logic')]));
      expect(models).toEqual(['sonnet']);
      expect(rows()[0]?.classifier).toBe('claude-code:sonnet');
    });

    it('keeps going after a bad answer or a failed call, saves the rest and exits 1', async () => {
      await addFailures(3);
      const result = await run(
        ['--yes'],
        deps([JSON.stringify({ structured_output: { category: 'typo' } }), new ClaudeError('claude did not answer in time', 'timeout'), answer('logic')]),
      );
      expect(result.code).toBe(1);
      expect(rows().map((row) => row.category)).toEqual([null, null, 'logic']);
      expect(result.out).toBe('Classified 1 of 3 failures\n  logic: 1\n  failed: 2\n');
      expect(result.err).toContain('unknown category');
      expect(result.err).toContain('did not answer in time');
    });

    it('tries failures that failed before last, so they do not block newer ones', async () => {
      await addFailures(3);
      await run(['--yes', '--limit', '1'], deps([JSON.stringify({ structured_output: { category: 'typo' } })]));
      await run(['--yes', '--limit', '1'], deps([answer('logic')]));
      expect(rows().map((row) => row.category)).toEqual([null, 'logic', null]);
    });

    it('refuses while another classify holds the lock, sending nothing', async () => {
      await addFailures(1);
      const { writeFile } = await import('node:fs/promises');
      // The parent of the test worker is alive and is not this process.
      await writeFile(join(repo.path, '.nightowl/classify.lock'), JSON.stringify({ pid: process.ppid }));
      const before = rows();
      const result = await run(['--yes'], deps([answer('logic')]));
      expect(result.code).toBe(1);
      expect(result.err).toContain(`another classify is running (pid ${process.ppid})`);
      expect(prompts).toEqual([]);
      expect(rows()).toEqual(before);
    });

    it('releases the lock when done, even after failed calls', async () => {
      await addFailures(2);
      await run(['--yes'], deps([answer('logic'), new ClaudeError('claude exited with code 1', 'exit')]));
      expect(await readdir(join(repo.path, '.nightowl'))).not.toContain('classify.lock');
    });

    it('fails without touching the database when claude is not installed', async () => {
      await addFailures(1);
      const before = rows();
      const result = await run(['--yes'], deps([answer('logic')], { isOnPath: () => false }));
      expect(result.code).toBe(1);
      expect(result.err).toMatch(/'claude' was not found/);
      expect(result.err).toMatch(/Install Claude Code/);
      expect(prompts).toEqual([]);
      expect(rows()).toEqual(before);
    });
  });

  it('says so when there is nothing to classify', async () => {
    await addFailures(0);
    expect(await run([], deps([answer('logic')]))).toEqual({ code: 0, out: 'No failures to classify.\n', err: '' });
  });

  it.each([[[]], [['--yes']]])('needs nightowl init, creating nothing and sending nothing (%j)', async (args) => {
    const result = await run(args, deps([answer('logic')]));
    expect(result.code).toBe(1);
    expect(result.err).toContain('nightowl init');
    expect(prompts).toEqual([]);
    expect(await readdir(repo.path)).toEqual(['.git']);
  });

  it('refuses a database older than this NightOwl without upgrading it', async () => {
    await addFailures(1);
    const db = new DatabaseSync(join(repo.path, '.nightowl/nightowl.db'));
    db.exec('PRAGMA user_version = 3');
    db.close();
    const result = await run(['--yes'], deps([answer('logic')]));
    expect(result.code).toBe(1);
    expect(result.err).toContain('nightowl init');
    expect(prompts).toEqual([]);
    const check = new DatabaseSync(join(repo.path, '.nightowl/nightowl.db'), { readOnly: true });
    try {
      expect((check.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(3);
    } finally {
      check.close();
    }
  });

  it.each([
    [['--limit', '0']],
    [['--limit', 'abc']],
    [['--limit', '101']],
    [['--model', '--dangerous']],
    [['--model=-x']],
    [['--transport', 'foo']],
    [['--unknown']],
    [['extra']],
  ])('rejects bad options %j', async (args) => {
    const result = await run(args, deps([answer('logic')]));
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/^nightowl classify: /);
    expect(prompts).toEqual([]);
  });

  describe('transport api', () => {
    it('defaults to cli and rejects unknown transport', async () => {
      await addFailures(1);
      const dry = await run([], deps([answer('logic')]));
      expect(dry.out).toContain('to Claude Code, model haiku');
      expect(dry.out).not.toContain('--transport');
      expect((await run(['--transport', 'smtp'], deps([answer('logic')]))).err).toContain('--transport must be cli or api');
    });

    it('dry-run mentions Anthropic host and does not call the API', async () => {
      await addFailures(1);
      const result = await run(['--transport', 'api', '--model', 'haiku'], deps([answer('logic')]));
      expect(result.code).toBe(0);
      expect(result.out).toContain('Anthropic API (api.anthropic.com)');
      expect(result.out).toContain('claude-haiku-4-5-20251001');
      expect(result.out).toContain('nightowl classify --yes --transport api');
      expect(result.out).toContain('ANTHROPIC_API_KEY is not set');
      expect(prompts).toEqual([]);
    });

    it('requires ANTHROPIC_API_KEY before calling the API', async () => {
      await addFailures(1);
      const before = rows();
      const result = await run(['--yes', '--transport', 'api'], deps([answer('logic')]));
      expect(result.code).toBe(1);
      expect(result.err).toContain('ANTHROPIC_API_KEY is not set');
      expect(prompts).toEqual([]);
      expect(rows()).toEqual(before);
    });

    it('classifies via runApi and records anthropic-api classifier with resolved model id', async () => {
      await addFailures(1);
      const result = await run(
        ['--yes', '--transport', 'api', '--model', 'haiku'],
        deps([answer('logic', 0.7)], { env: () => ({ ANTHROPIC_API_KEY: 'sk-test' }) }),
      );
      expect(result.code).toBe(0);
      expect(models).toEqual(['haiku']);
      expect(rows()[0]).toMatchObject({
        category: 'logic',
        classifier: 'anthropic-api:claude-haiku-4-5-20251001',
        category_confidence: 0.7,
      });
    });

    it('does not require claude on PATH when using the API', async () => {
      await addFailures(1);
      const result = await run(
        ['--yes', '--transport', 'api'],
        deps([answer('logic')], { isOnPath: () => false, env: () => ({ ANTHROPIC_API_KEY: 'sk-test' }) }),
      );
      expect(result.code).toBe(0);
      expect(rows()[0]?.classifier).toBe('anthropic-api:claude-haiku-4-5-20251001');
    });
  });

  it('fails outside a git repository', async () => {
    const outside = await createTempDir();
    try {
      const result = await run(['--yes'], deps([answer('logic')], { cwd: () => outside.path }));
      expect(result.code).toBe(1);
      expect(result.err).toMatch(/git repository/);
    } finally {
      await outside.cleanup();
    }
  });
});

describe('printable', () => {
  it('replaces terminal control characters in repository paths', async () => {
    const { printable } = await import('../../src/shared/printable.js');
    expect(printable('src/\u001b[2Jevil\n.ts')).toBe('src/?[2Jevil?.ts');
    expect(printable('src/đơn hàng.ts')).toBe('src/đơn hàng.ts');
  });
});

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

  async function addFailures(count: number, prompt: string | null = 'add email validation'): Promise<number[]> {
    const store = await openStore({ cwd: repo.path });
    try {
      const ids: number[] = [];
      for (let i = 0; i < count; i++) {
        const promptId =
          prompt === null ? null : store.insertEvent({ source: 'claude-code', kind: 'prompt', sessionId: 's', payload: { prompt } }).id;
        const edit = store.insertEvent({ source: 'claude-code', kind: 'edit', sessionId: 's', filePath: `f${i}.ts`, payload: {} });
        const check = store.insertEvent({ source: 'git', kind: 'commit-check', filePath: `f${i}.ts`, payload: {} });
        store.attachChecks('sha', [
          {
            checkId: check.id,
            outcome: 'failure',
            failure: { filePath: `f${i}.ts`, aiEventId: edit.id, promptEventId: promptId, aiContent: 'ai\n', finalContent: 'dev\n' },
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
    return {
      cwd: () => repo.path,
      isOnPath: () => true,
      now: () => new Date('2026-11-04T10:00:00.000Z'),
      runClaude: async (prompt, options) => {
        prompts.push(prompt);
        models.push(options.model);
        const response = responses[call++ % responses.length] as string | Error;
        if (response instanceof Error) throw response;
        return response;
      },
      ...overrides,
    };
  }

  async function run(args: readonly string[], d: ClassifyDeps) {
    const fake = createFakeIo();
    const code = await createClassifyCommand(d).run(args, fake.io);
    return { code, out: fake.out(), err: fake.err() };
  }

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
    expect(await run([], deps([answer('logic')]))).toEqual({ code: 0, out: 'No failures to classify.\n', err: '' });
  });

  it.each([
    [['--limit', '0']],
    [['--limit', 'abc']],
    [['--limit', '101']],
    [['--model', '--dangerous']],
    [['--model=-x']],
    [['--unknown']],
    [['extra']],
  ])('rejects bad options %j', async (args) => {
    const result = await run(args, deps([answer('logic')]));
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/^nightowl classify: /);
    expect(prompts).toEqual([]);
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

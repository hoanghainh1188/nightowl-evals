import { readdir } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { run } from '../../src/cli/run.js';
import { createReviewCommand } from '../../src/commands/review.js';
import { openStore } from '../../src/storage/store.js';
import { createFakeIo } from '../helpers/fake-io.js';
import { seed } from '../helpers/seed-failures.js';
import { createFakeRepo, createTempDir, type TempDir } from '../helpers/temp-repo.js';

describe('nightowl review', () => {
  let repo: TempDir;
  let ids: number[];

  beforeEach(async () => {
    repo = await createFakeRepo();
    ids = await seed(repo.path, [
      { filePath: 'a.ts', prompt: 'first', createdAt: '2026-11-01T00:00:00.000Z' },
      { filePath: 'b.ts', status: 'dismissed', createdAt: '2026-11-02T00:00:00.000Z' },
      { filePath: 'c.ts', source: 'ai-self-fix', prompt: 'isAdult', feedback: 'wrong, 18 counts', createdAt: '2026-11-03T00:00:00.000Z' },
    ]);
  });
  afterEach(() => repo.cleanup());

  async function review(args: readonly string[], cwd = repo.path) {
    const fake = createFakeIo();
    const code = await createReviewCommand({ cwd: () => cwd }).run(args, fake.io);
    return { code, out: fake.out(), err: fake.err() };
  }

  async function statuses(): Promise<string[]> {
    const store = await openStore({ cwd: repo.path, readOnly: true });
    try {
      return ids.map((id) => store.getFailureForReview(id)?.status ?? 'missing');
    } finally {
      store.close();
    }
  }

  describe('list', () => {
    it('lists flagged failures by default, newest first', async () => {
      const result = await review([]);
      expect(result.code).toBe(0);
      expect(result.out.split('\n').filter((line) => line.startsWith('#')).map((line) => line.split(/\s+/)[0])).toEqual([
        `#${ids[2]}`,
        `#${ids[0]}`,
      ]);
      expect(await review(['list'])).toEqual(result);
    });

    it('filters by status and source and limits', async () => {
      const { out } = await review(['list', '--status', 'all', '--source', 'ai-self-fix']);
      expect(out).toContain('c.ts');
      expect(out).not.toContain('a.ts');
      expect((await review(['--status', 'dismissed'])).out).toContain('b.ts');
      expect((await review(['--status', 'all', '--limit', '1'])).out.match(/^#/gm)).toHaveLength(1);
    });
  });

  describe('show', () => {
    it('prints one failure with its feedback', async () => {
      const result = await review(['show', `#${ids[2]}`]);
      expect(result.code).toBe(0);
      expect(result.out).toContain('Feedback\n  wrong, 18 counts');
    });

    it('fails on an unknown id', async () => {
      expect(await review(['show', '999'])).toEqual({ code: 1, out: '', err: 'nightowl review: no failure #999\n' });
    });
  });

  describe('marking', () => {
    it('dismisses, confirms and resets, accepting #12 and 12', async () => {
      const [a, b, c] = ids as [number, number, number];
      const dismissed = await review(['dismiss', `#${a}`, String(c)]);
      expect(dismissed).toEqual({ code: 0, out: `Dismissed 2 failures (#${a}, #${c}).\n`, err: '' });
      expect(await statuses()).toEqual(['dismissed', 'dismissed', 'dismissed']);

      expect((await review(['confirm', String(a)])).out).toBe(`Confirmed 1 failure (#${a}).\n`);
      expect((await review(['reset', String(b), String(a)])).out).toBe(`Reset 2 failures (#${a}, #${b}) to flagged.\n`);
      expect(await statuses()).toEqual(['flagged', 'flagged', 'dismissed']);
    });

    it('says when a failure already had that status', async () => {
      const [, b] = ids as [number, number];
      expect((await review(['dismiss', String(b)])).out).toBe(`No change: #${b} was already dismissed.\n`);
    });

    it('changes nothing when one id is unknown', async () => {
      const [a] = ids as [number];
      expect(await review(['confirm', String(a), '999'])).toEqual({
        code: 1,
        out: '',
        err: 'nightowl review: no failure #999; nothing was changed\n',
      });
      expect(await statuses()).toEqual(['flagged', 'dismissed', 'flagged']);
    });
  });

  it.each([
    [['dismis', '1'], 'unknown subcommand'],
    [['show'], 'one id'],
    [['show', '1', '2'], 'one id'],
    [['confirm'], 'at least one id'],
    [['confirm', 'abc'], "'abc' is not a failure id"],
    [['confirm', '0'], "'0' is not a failure id"],
    [['--status', 'done'], '--status'],
    [['--source', 'x'], '--source'],
    [['--limit', '201'], '--limit'],
    [['--limit', '1e2'], '--limit'],
    [['confirm', '012'], "'012' is not a failure id"],
    [['confirm', '1e3'], "'1e3' is not a failure id"],
    [['confirm', '12345678901'], "'12345678901' is not a failure id"],
    [['confirm', ...Array.from({ length: 201 }, (_, i) => String(i + 1))], 'at most 200 ids'],
    [['list', 'extra'], 'extra'],
    [['--weird'], '--weird'],
  ])('rejects %j', async (args, message) => {
    const result = await review(args);
    expect(result.code).toBe(1);
    expect(result.err).toContain(message);
    expect(result.err).toContain("nightowl review --help");
    expect(await statuses()).toEqual(['flagged', 'dismissed', 'flagged']);
  });

  it('shows a failure without letting its code drive the terminal', async () => {
    const [id] = await seed(repo.path, [{ filePath: 'e.ts', finalContent: 'x = "\u001b[2J"\n' }]);
    const result = await review(['show', String(id)]);
    expect(result.code).toBe(0);
    expect(result.out).not.toContain('\u001b');
  });

  it('says what to do with --status all and no failures', async () => {
    const empty = await createFakeRepo();
    try {
      await seed(empty.path, []);
      expect((await review(['--status', 'all'], empty.path)).out).toBe('No failures match.\n');
    } finally {
      await empty.cleanup();
    }
  });

  it('refuses to mark failures in a database older than this NightOwl', async () => {
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(`${repo.path}/.nightowl/nightowl.db`);
    db.exec('PRAGMA user_version = 3');
    db.close();
    const result = await review(['dismiss', String(ids[0])]);
    expect(result.code).toBe(1);
    expect(result.err).toContain('nightowl init');
    const check = new DatabaseSync(`${repo.path}/.nightowl/nightowl.db`, { readOnly: true });
    try {
      expect((check.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(3);
    } finally {
      check.close();
    }
  });

  it('needs nightowl init and creates nothing', async () => {
    const bare = await createFakeRepo();
    try {
      for (const args of [[], ['dismiss', '1']]) {
        const result = await review(args, bare.path);
        expect(result.code).toBe(1);
        expect(result.err).toContain('nightowl init');
      }
      expect(await readdir(bare.path)).toEqual(['.git']);
    } finally {
      await bare.cleanup();
    }
  });

  it('fails outside a git repository', async () => {
    const outside = await createTempDir();
    try {
      expect((await review(['dismiss', '1'], outside.path)).code).toBe(1);
      expect(await readdir(outside.path)).toEqual([]);
    } finally {
      await outside.cleanup();
    }
  });

  it('is registered, with help for every subcommand', async () => {
    const fake = createFakeIo();
    expect(await run(['review', '--help'], fake.io)).toBe(0);
    for (const word of ['list', 'show', 'confirm', 'dismiss', 'reset', '--status', '--source', '--limit']) {
      expect(fake.out()).toContain(word);
    }
    const general = createFakeIo();
    await run(['--help'], general.io);
    expect(general.out()).toMatch(/^ {2}review +\S/m);
  });
});

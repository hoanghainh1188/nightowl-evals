import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createReportCommand } from '../../src/commands/report.js';
import { createFakeIo } from '../helpers/fake-io.js';
import { seed } from '../helpers/seed-failures.js';
import { createFakeRepo, createTempDir, type TempDir } from '../helpers/temp-repo.js';

describe('nightowl report', () => {
  let repo: TempDir;
  beforeEach(async () => {
    repo = await createFakeRepo();
  });
  afterEach(() => repo.cleanup());

  async function run(args: readonly string[] = [], cwd = repo.path) {
    const fake = createFakeIo();
    const command = createReportCommand({ cwd: () => cwd, now: () => new Date('2026-11-04T12:00:00.000Z') });
    const code = await command.run(args, fake.io);
    return { code, out: fake.out(), err: fake.err() };
  }

  const spec = [
    { filePath: 'src/hooks/a.ts', category: 'logic' },
    { filePath: 'src/hooks/b.ts', category: 'logic' },
    { filePath: 'src/hooks/git/c.ts', category: 'logic' },
    { filePath: 'src/cli/d.ts', category: 'convention' },
    { filePath: 'src/cli/e.ts', category: null },
  ] as const;

  it('reports by category and module', async () => {
    await seed(repo.path, spec);
    const result = await run();
    expect(result.code).toBe(0);
    expect(result.err).toBe('');
    expect(result.out).toContain('5 failures (1 unclassified, 0 dismissed not counted)');
    expect(result.out).toMatch(/^ {2}logic +3 /m);
    expect(result.out).toMatch(/^ {2}convention +1 /m);
    expect(result.out).toMatch(/^ {2}unclassified +1 /m);
    expect(result.out).toMatch(/^ {2}src\/hooks +3 /m);
    expect(result.out).toMatch(/^ {2}src\/cli +2 /m);
  });

  it('prints JSON, honouring --depth and --since', async () => {
    await seed(repo.path, [
      { filePath: 'src/hooks/git/a.ts', createdAt: '2026-10-01T00:00:00.000Z' },
      { filePath: 'src/hooks/git/a.ts', createdAt: '2026-11-03T00:00:00.000Z' },
      { filePath: 'README.md', createdAt: '2026-11-03T00:00:00.000Z' },
    ]);
    const all = JSON.parse((await run(['--json', '--depth', '1'])).out);
    expect(all.by_module).toEqual([
      { module: 'src', failures: 2 },
      { module: '(root)', failures: 1 },
    ]);
    const recent = JSON.parse((await run(['--json', '--since', '2026-11-01'])).out);
    expect(recent.total).toBe(2);
    expect(recent.since).toBe('2026-11-01T00:00:00.000Z');
  });

  it('says when nothing is recorded yet', async () => {
    await seed(repo.path, []);
    expect(await run()).toMatchObject({ code: 0, err: '' });
    expect((await run()).out).toContain('No failures recorded yet');
  });

  it('does not change the database', async () => {
    await seed(repo.path, spec);
    const db = join(repo.path, '.nightowl/nightowl.db');
    const before = await readFile(db);
    await run();
    await run(['--json']);
    expect((await readFile(db)).equals(before)).toBe(true);
  });

  it.each([[['--since', '04/11/2026']], [['--depth', '0']], [['--depth', '6']], [['--weird']], [['extra']]])(
    'rejects %j',
    async (args) => {
      await seed(repo.path, spec);
      const result = await run(args);
      expect(result.code).toBe(1);
      expect(result.out).toBe('');
      expect(result.err).toMatch(/^nightowl report: /);
    },
  );

  it('asks for nightowl init and creates nothing when the project is not set up', async () => {
    const result = await run();
    expect(result.code).toBe(1);
    expect(result.err).toContain("Run 'nightowl init' first");
    expect(await readdir(repo.path)).toEqual(['.git']);
  });

  it('fails outside a git repository', async () => {
    const outside = await createTempDir();
    try {
      const result = await run([], outside.path);
      expect(result.code).toBe(1);
      expect(result.err).toMatch(/git repository/);
    } finally {
      await outside.cleanup();
    }
  });
});

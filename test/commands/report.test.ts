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
    expect(all.signals).toEqual({ ci_fail: 0, pr_review: 0, revert: 0 });
    const recent = JSON.parse((await run(['--json', '--since', '2026-11-01'])).out);
    expect(recent.total).toBe(2);
    expect(recent.since).toBe('2026-11-01T00:00:00.000Z');
  });

  it('counts CI/PR signal events separately from failures', async () => {
    await seed(repo.path, []);
    const { openStore } = await import('../../src/storage/store.js');
    const store = await openStore({ cwd: repo.path });
    store.insertEvent({
      source: 'ci',
      kind: 'ci-fail',
      dedupeKey: 'ci:r1',
      payload: { test_name: 't' },
      createdAt: '2026-11-04T00:00:00.000Z',
    });
    store.insertEvent({
      source: 'pr',
      kind: 'pr-review',
      dedupeKey: 'pr:id:1',
      payload: { body: 'nit' },
      createdAt: '2026-11-04T00:00:00.000Z',
    });
    store.insertEvent({
      source: 'git',
      kind: 'revert',
      dedupeKey: 'revert:a:b',
      payload: { reverted_commit_sha: 'a', revert_commit_sha: 'b', failure_ids: [1] },
      createdAt: '2026-11-04T00:00:00.000Z',
    });
    store.close();
    const json = JSON.parse((await run(['--json'])).out);
    expect(json.total).toBe(0);
    expect(json.signals).toEqual({ ci_fail: 1, pr_review: 1, revert: 1 });
    expect((await run()).out).toContain('Signals (events, not failures): ci-fail 1, pr-review 1, revert 1');
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

  it('creates nothing when .nightowl/ exists without a database', async () => {
    const { mkdir } = await import('node:fs/promises');
    await mkdir(join(repo.path, '.nightowl'));
    const result = await run();
    expect(result.code).toBe(1);
    expect(result.err).toContain("Run 'nightowl init' first");
    expect(await readdir(join(repo.path, '.nightowl'))).toEqual([]);
  });

  it('does not migrate an older database, and asks for nightowl init', async () => {
    await seed(repo.path, spec);
    const { DatabaseSync } = await import('node:sqlite');
    const file = join(repo.path, '.nightowl/nightowl.db');
    const db = new DatabaseSync(file);
    db.exec('PRAGMA user_version = 2');
    db.close();
    const before = await readFile(file);
    const result = await run();
    expect(result.code).toBe(1);
    expect(result.err).toContain("Run 'nightowl init' to upgrade it");
    expect((await readFile(file)).equals(before)).toBe(true);
    // SQLite may add its own -wal/-shm index files when reading a WAL database; nothing else.
    expect((await readdir(join(repo.path, '.nightowl'))).every((name) => name.startsWith('nightowl.db'))).toBe(true);
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

  it('writes output to a specified file with --output or -o', async () => {
    await seed(repo.path, spec);
    const outFile = join(repo.path, 'nested/dir/report.json');
    const result = await run(['--json', '--output', outFile]);
    expect(result.code).toBe(0);
    expect(result.err).toBe('');
    const content = await readFile(outFile, 'utf8');
    const parsed = JSON.parse(content);
    expect(parsed.total).toBe(5);
    expect(result.out).toBe(content);

    // Test with short flag -o
    const outTextFile = join(repo.path, 'report.txt');
    const resultText = await run(['-o', outTextFile]);
    expect(resultText.code).toBe(0);
    const textContent = await readFile(outTextFile, 'utf8');
    expect(textContent).toContain('NightOwl report');
    expect(resultText.out).toBe(textContent);
  });

  it('enforces CI quality gate with --fail-on-rate', async () => {
    // 2 failures, 2 non-failures -> 4 checks, failure rate = 50%
    const checks = [
      { createdAt: '2026-11-04T10:00:00.000Z', outcome: 'failure' as const },
      { createdAt: '2026-11-04T10:01:00.000Z', outcome: 'failure' as const },
      { createdAt: '2026-11-04T10:02:00.000Z', outcome: 'not-a-failure' as const },
      { createdAt: '2026-11-04T10:03:00.000Z', outcome: 'not-a-failure' as const },
    ];
    await seed(repo.path, spec, checks);

    // Exceeds threshold: 50% > 40% -> code 1
    const failResult = await run(['--fail-on-rate', '40']);
    expect(failResult.code).toBe(1);
    expect(failResult.err).toContain('failure rate (50%) exceeds threshold of 40%');
    expect(failResult.out).toContain('5 failures');

    // Within threshold: 50% <= 60% -> code 0
    const passResult = await run(['--fail-on-rate', '60']);
    expect(passResult.code).toBe(0);
    expect(passResult.err).toBe('');

    // Exact threshold: 50% <= 50% -> code 0
    const exactResult = await run(['--fail-on-rate', '50']);
    expect(exactResult.code).toBe(0);
    expect(exactResult.err).toBe('');
  });

  it('allows --fail-on-rate to pass when no checks exist', async () => {
    await seed(repo.path, spec, []);
    const result = await run(['--fail-on-rate', '10']);
    expect(result.code).toBe(0);
    expect(result.err).toBe('');
  });

  it.each([[['--fail-on-rate', '-1']], [['--fail-on-rate', '101']], [['--fail-on-rate', 'invalid']], [['--output', '   ']]])(
    'rejects invalid gate and output arguments %j',
    async (args) => {
      await seed(repo.path, spec);
      const result = await run(args);
      expect(result.code).toBe(1);
      expect(result.err).toMatch(/^nightowl report: /);
    },
  );
});

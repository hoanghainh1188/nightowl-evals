import { lstat, readdir, readFile, stat, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createExportCommand } from '../../src/commands/export.js';
import { createFakeIo } from '../helpers/fake-io.js';
import { createGitRepo, git } from '../helpers/git-repo.js';
import { seed } from '../helpers/seed-failures.js';
import { createTempDir, type TempDir } from '../helpers/temp-repo.js';

describe('nightowl export', () => {
  let repo: TempDir;
  const defaultFile = () => join(repo.path, '.nightowl/export/evals.jsonl');

  beforeEach(async () => {
    repo = await createGitRepo();
  });
  afterEach(() => repo.cleanup());

  async function run(args: readonly string[] = [], cwd = repo.path) {
    const fake = createFakeIo();
    const code = await createExportCommand({ cwd: () => cwd }).run(args, fake.io);
    return { code, out: fake.out(), err: fake.err() };
  }

  const lines = async (file = defaultFile()) =>
    (await readFile(file, 'utf8'))
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);

  it('writes one private JSON line per failure into .nightowl/export/', async () => {
    await seed(repo.path, [
      { filePath: 'a.ts', aiContent: 'ai a\n', finalContent: 'dev a\n', category: 'logic' },
      { filePath: 'b.ts', aiContent: 'ai b\n', finalContent: 'dev b\n' },
      { filePath: 'c.ts', status: 'dismissed' },
    ]);
    const result = await run();
    expect(result.code).toBe(0);
    expect(result.out).toBe('');
    expect(result.err).toContain('exported 2 eval cases to .nightowl/export/evals.jsonl');
    expect(result.err).toContain('keep it private');
    const cases = await lines();
    expect(cases.map((c) => [c.schema, c.file_path, c.rejected, c.expected])).toEqual([
      ['nightowl.eval/v1', 'a.ts', 'ai a\n', 'dev a\n'],
      ['nightowl.eval/v1', 'b.ts', 'ai b\n', 'dev b\n'],
    ]);
    expect((await stat(defaultFile())).mode & 0o777).toBe(0o600);
    expect((await stat(join(repo.path, '.nightowl/export'))).mode & 0o777).toBe(0o700);
  });

  it('gives the same file when run twice', async () => {
    await seed(repo.path, [{ filePath: 'a.ts' }, { filePath: 'b.ts' }]);
    await run();
    const first = await readFile(defaultFile(), 'utf8');
    await run();
    expect(await readFile(defaultFile(), 'utf8')).toBe(first);
  });

  it('writes an empty file and says so when there is nothing', async () => {
    await seed(repo.path, []);
    expect((await run()).err).toContain('exported 0 eval cases');
    expect(await readFile(defaultFile(), 'utf8')).toBe('');
  });

  it('prints to stdout with --out - and writes to another file with --out', async () => {
    await seed(repo.path, [{ filePath: 'a.ts' }]);
    const stdout = await run(['--out', '-']);
    expect(JSON.parse(stdout.out.trim()).file_path).toBe('a.ts');
    expect(await readdir(join(repo.path, '.nightowl'))).not.toContain('export');
    await run(['--out', 'evals.jsonl']);
    expect((await lines(join(repo.path, 'evals.jsonl'))).length).toBe(1);
  });

  it('replaces an earlier export but not another file, unless --force', async () => {
    await seed(repo.path, [{ filePath: 'a.ts' }]);
    await writeFile(join(repo.path, 'notes.txt'), 'my notes\n');
    const refused = await run(['--out', 'notes.txt']);
    expect(refused.code).toBe(1);
    expect(refused.err).toContain('is not a NightOwl export; use --force');
    expect(await readFile(join(repo.path, 'notes.txt'), 'utf8')).toBe('my notes\n');
    expect((await run(['--out', 'notes.txt', '--force'])).code).toBe(0);
    expect((await run(['--out', 'notes.txt'])).code).toBe(0);
    await writeFile(join(repo.path, 'empty.jsonl'), '');
    expect((await run(['--out', 'empty.jsonl'])).code).toBe(0);
  });

  it('warns when git would not ignore the file', async () => {
    await seed(repo.path, [{ filePath: 'a.ts' }]);
    expect((await run(['--out', 'evals.jsonl'])).err).toContain('git does not ignore this file');
    await writeFile(join(repo.path, '.gitignore'), '.nightowl/\n*.jsonl\n');
    expect((await run(['--out', 'evals.jsonl'])).err).not.toContain('git does not ignore');
    expect((await run()).err).not.toContain('git does not ignore');
  });

  it('never exports failures in sensitive files', async () => {
    await seed(repo.path, [{ filePath: 'a.ts' }, { filePath: '.env', aiContent: 'API_KEY=1\n' }, { filePath: 'keys/id_rsa' }]);
    const result = await run();
    expect(result.err).toContain('exported 1 eval cases');
    expect(result.err).toContain('Left out 2 failures in sensitive files');
    expect(await readFile(defaultFile(), 'utf8')).not.toContain('API_KEY');
  });

  it('filters by --since and repeated --category', async () => {
    await seed(repo.path, [
      { filePath: 'a.ts', category: 'logic', createdAt: '2026-11-01T00:00:00.000Z' },
      { filePath: 'b.ts', category: 'logic', createdAt: '2026-11-03T00:00:00.000Z' },
      { filePath: 'c.ts', category: 'convention', createdAt: '2026-11-03T00:00:00.000Z' },
      { filePath: 'd.ts', category: null, createdAt: '2026-11-03T00:00:00.000Z' },
    ]);
    await run(['--category', 'logic']);
    expect((await lines()).map((c) => c.file_path)).toEqual(['a.ts', 'b.ts']);
    await run(['--since', '2026-11-02', '--category', 'logic', '--category', 'unclassified']);
    expect((await lines()).map((c) => c.file_path)).toEqual(['b.ts', 'd.ts']);
  });

  it('reads the file before the commit from git', async () => {
    await writeFile(join(repo.path, 'a.ts'), 'v0\n');
    git(repo.path, ['add', '-A']);
    git(repo.path, ['commit', '-q', '-m', 'v0']);
    await writeFile(join(repo.path, 'a.ts'), 'v2\n');
    git(repo.path, ['add', '-A']);
    git(repo.path, ['commit', '-q', '-m', 'v2']);
    const sha = git(repo.path, ['rev-parse', 'HEAD']).trim();
    await seed(repo.path, [
      { filePath: 'a.ts', commitSha: sha, aiContent: 'v1\n', finalContent: 'v2\n' },
      { filePath: 'new.ts', commitSha: sha },
    ]);
    await run();
    const [a, created] = await lines();
    expect(a?.input).toEqual({ prompt: null, file_before: 'v0\n', feedback: null });
    expect(a?.id).toMatch(new RegExp(`^${sha.slice(0, 12)}-\\d+$`));
    expect(created?.input).toEqual({ prompt: null, file_before: null, feedback: null });
  });

  it('refuses to write through a symlink', async () => {
    await seed(repo.path, [{ filePath: 'a.ts' }]);
    await writeFile(join(repo.path, 'target.txt'), 'keep\n');
    await symlink(join(repo.path, 'target.txt'), join(repo.path, 'link.jsonl'));
    const result = await run(['--out', 'link.jsonl']);
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/symlink/);
    expect(await readFile(join(repo.path, 'target.txt'), 'utf8')).toBe('keep\n');
    expect((await lstat(join(repo.path, 'link.jsonl'))).isSymbolicLink()).toBe(true);
  });

  it('fails when the --out folder does not exist', async () => {
    await seed(repo.path, [{ filePath: 'a.ts' }]);
    const result = await run(['--out', 'missing/dir/evals.jsonl']);
    expect(result.code).toBe(1);
    expect(await readdir(repo.path)).not.toContain('missing');
  });

  it('keeps every id when a filter leaves other failures out', async () => {
    await seed(repo.path, [
      { filePath: 'a.ts', category: 'logic' },
      { filePath: 'a.ts', category: 'convention' },
    ]);
    await run();
    const all = await lines();
    await run(['--category', 'convention']);
    expect((await lines()).map((c) => c.id)).toEqual([all[1]?.id]);
  });

  it('does not change the database', async () => {
    await seed(repo.path, [{ filePath: 'a.ts' }]);
    const db = join(repo.path, '.nightowl/nightowl.db');
    const before = await readFile(db);
    await run();
    expect((await readFile(db)).equals(before)).toBe(true);
  });

  it.each([[['--since', 'yesterday']], [['--category', 'typo']], [['--out', '']], [['--weird']], [['extra']]])(
    'rejects %j without writing',
    async (args) => {
      await seed(repo.path, [{ filePath: 'a.ts' }]);
      const result = await run(args);
      expect(result.code).toBe(1);
      expect(result.err).toMatch(/^nightowl export: /);
      expect(await readdir(join(repo.path, '.nightowl'))).not.toContain('export');
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
      expect((await run([], outside.path)).code).toBe(1);
      expect(await readdir(outside.path)).toEqual([]);
    } finally {
      await outside.cleanup();
    }
  });
});

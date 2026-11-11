import { mkdir, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCustomerReportCommand } from '../../src/commands/customer-report.js';
import { createFakeIo } from '../helpers/fake-io.js';
import { seed } from '../helpers/seed-failures.js';
import { createFakeRepo, type TempDir } from '../helpers/temp-repo.js';

describe('nightowl customer-report', () => {
  let repo: TempDir;
  beforeEach(async () => {
    repo = await createFakeRepo();
  });
  afterEach(() => repo.cleanup());

  async function run(args: readonly string[] = [], cwd = repo.path) {
    const fake = createFakeIo();
    const command = createCustomerReportCommand({
      cwd: () => cwd,
      now: () => new Date('2026-11-11T12:00:00.000Z'),
    });
    const code = await command.run(args, fake.io);
    return { code, out: fake.out(), err: fake.err() };
  }

  it('prints bilingual Markdown with metrics', async () => {
    await seed(
      repo.path,
      [
        { filePath: 'src/hooks/a.ts', category: 'logic' },
        { filePath: 'src/cli/b.ts', category: 'convention' },
      ],
      [
        { createdAt: '2026-11-04T10:00:00.000Z', outcome: 'failure' },
        { createdAt: '2026-11-04T11:00:00.000Z', outcome: 'not-a-failure' },
        { createdAt: '2026-11-04T12:00:00.000Z', outcome: 'not-a-failure' },
        { createdAt: '2026-11-04T13:00:00.000Z', outcome: 'not-a-failure' },
      ],
    );
    const result = await run();
    expect(result.code).toBe(0);
    expect(result.err).toBe('');
    expect(result.out).toContain('Báo cáo chất lượng AI (NightOwl)');
    expect(result.out).toContain('AI品質レポート（NightOwl）');
    expect(result.out).toContain('25%');
    expect(result.out).toContain('logic');
    expect(result.out).toContain('src/hooks');
  });

  it('supports --lang ja and --format html', async () => {
    await seed(repo.path, [{ filePath: 'src/a.ts', category: 'logic' }]);
    const result = await run(['--lang', 'ja', '--format', 'html']);
    expect(result.code).toBe(0);
    expect(result.out.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(result.out).toContain('AI品質レポート');
    expect(result.out).not.toContain('Báo cáo chất lượng AI');
  });

  it('says when nothing is recorded yet', async () => {
    await seed(repo.path, []);
    const result = await run(['--lang', 'vi']);
    expect(result.code).toBe(0);
    expect(result.out).toContain('Chưa có đủ dữ liệu');
  });

  it('filters by --agent', async () => {
    await seed(repo.path, [
      { filePath: 'src/a.ts', category: 'logic', agent: 'claude-code' },
      { filePath: 'src/b.ts', category: 'convention', agent: 'cursor' },
    ]);
    const result = await run(['--agent', 'claude-code', '--lang', 'vi']);
    expect(result.code).toBe(0);
    expect(result.out).toContain('claude-code');
    expect(result.out).not.toMatch(/- \*\*cursor\*\*:/);
  });

  it('does not leak author-like strings from failure content', async () => {
    const secret = 'Alice Developer <alice@example.com>';
    await seed(repo.path, [
      {
        filePath: 'src/a.ts',
        category: 'logic',
        aiContent: `patch by ${secret}\n`,
        finalContent: `fixed by ${secret}\n`,
        prompt: `please help ${secret}`,
        reason: secret,
      },
    ]);
    const result = await run();
    expect(result.code).toBe(0);
    expect(result.out).not.toContain('Alice Developer');
    expect(result.out).not.toContain('alice@example.com');
  });

  it('asks for nightowl init when not set up', async () => {
    const result = await run();
    expect(result.code).toBe(1);
    expect(result.err).toContain("Run 'nightowl init' first");
    expect(await readdir(repo.path)).toEqual(['.git']);
  });

  it.each([
    [['--since', '11/11/2026']],
    [['--depth', '0']],
    [['--lang', 'en']],
    [['--format', 'pdf']],
    [['--fail-on-rate', '30']],
    [['--weird']],
  ])('rejects %j', async (args) => {
    await seed(repo.path, [{ filePath: 'src/a.ts' }]);
    const result = await run(args);
    expect(result.code).toBe(1);
    expect(result.out).toBe('');
    expect(result.err).toMatch(/^nightowl customer-report: /);
  });

  it('writes --output without dumping the full report to stdout', async () => {
    await seed(repo.path, [{ filePath: 'src/hooks/a.ts', category: 'logic' }]);
    const outPath = join(repo.path, 'dist/reports/customer.md');
    const result = await run(['--output', outPath, '--lang', 'both']);
    expect(result.code).toBe(0);
    expect(result.err).toBe('');
    expect(result.out).toBe('');
    const body = await readFile(outPath, 'utf8');
    expect(body).toContain('Báo cáo chất lượng AI');
    expect(body).toContain('AI品質レポート');
  });

  it('creates parent directories for --output', async () => {
    await seed(repo.path, [{ filePath: 'src/a.ts' }]);
    const nested = join(repo.path, 'a/b/c/report.html');
    const result = await run(['-o', nested, '--format', 'html']);
    expect(result.code).toBe(0);
    const body = await readFile(nested, 'utf8');
    expect(body).toContain('<!DOCTYPE html>');
  });

  it('creates nothing when .nightowl exists without a database', async () => {
    await mkdir(join(repo.path, '.nightowl'), { recursive: true });
    const result = await run();
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/nightowl customer-report:/);
    expect(await readdir(join(repo.path, '.nightowl'))).toEqual([]);
  });
});

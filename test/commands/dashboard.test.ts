import { mkdir, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDashboardCommand } from '../../src/commands/dashboard.js';
import { createFakeIo } from '../helpers/fake-io.js';
import { seed } from '../helpers/seed-failures.js';
import { createFakeRepo, type TempDir } from '../helpers/temp-repo.js';

describe('nightowl dashboard', () => {
  let repo: TempDir;
  beforeEach(async () => {
    repo = await createFakeRepo();
  });
  afterEach(() => repo.cleanup());

  async function run(
    args: readonly string[] = [],
    extras: { openPath?: (path: string) => void } = {},
  ) {
    const fake = createFakeIo();
    const command = createDashboardCommand({
      cwd: () => repo.path,
      now: () => new Date('2026-11-11T12:00:00.000Z'),
      ...(extras.openPath !== undefined ? { openPath: extras.openPath } : {}),
    });
    const code = await command.run(args, fake.io);
    return { code, out: fake.out(), err: fake.err() };
  }

  it('writes default .nightowl/dashboard.html with metrics', async () => {
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
    const outPath = join(repo.path, '.nightowl', 'dashboard.html');
    const result = await run();
    expect(result.code).toBe(0);
    expect(result.err).toBe('');
    expect(result.out.trim()).toBe(outPath);
    const html = await readFile(outPath, 'utf8');
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('logic');
    expect(html).toContain('src/hooks');
    expect(html).toContain('25%');
    expect(html).not.toMatch(/https?:\/\//);
  });

  it('writes --output path and filters --agent', async () => {
    await seed(repo.path, [
      { filePath: 'src/a.ts', category: 'logic', agent: 'claude-code' },
      { filePath: 'src/b.ts', category: 'convention', agent: 'cursor' },
    ]);
    const outPath = join(repo.path, 'dist', 'ai-dashboard.html');
    const result = await run(['--output', outPath, '--agent', 'claude-code', '--depth', '1']);
    expect(result.code).toBe(0);
    const html = await readFile(outPath, 'utf8');
    expect(html).toContain('claude-code');
    expect(html).not.toMatch(/>cursor</);
  });

  it('does not leak author-like strings', async () => {
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
    const html = await readFile(join(repo.path, '.nightowl', 'dashboard.html'), 'utf8');
    expect(html).not.toContain('Alice Developer');
    expect(html).not.toContain('alice@example.com');
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
    [['--fail-on-rate', '30']],
    [['--weird']],
    [['--output', '']],
    [['--workspace', 'missing-pkg']],
  ])('rejects %j', async (args) => {
    await seed(repo.path, [{ filePath: 'src/a.ts' }]);
    const result = await run(args);
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/^nightowl dashboard: /);
  });

  it('calls opener with --open and fails when opener throws', async () => {
    await seed(repo.path, [{ filePath: 'src/a.ts', category: 'logic' }]);
    const openPath = vi.fn();
    const ok = await run(['--open'], { openPath });
    expect(ok.code).toBe(0);
    expect(openPath).toHaveBeenCalledWith(join(repo.path, '.nightowl', 'dashboard.html'));

    openPath.mockImplementation(() => {
      throw new Error('no browser');
    });
    const fail = await run(['--open'], { openPath });
    expect(fail.code).toBe(1);
    expect(fail.err).toContain('failed to open');
    expect(fail.err).toContain('no browser');
  });

  it('creates parent dirs for default path when .nightowl exists from init/seed', async () => {
    await seed(repo.path, []);
    await mkdir(join(repo.path, '.nightowl'), { recursive: true });
    const result = await run();
    expect(result.code).toBe(0);
    const html = await readFile(join(repo.path, '.nightowl', 'dashboard.html'), 'utf8');
    expect(html).toContain('Not enough data yet');
  });
});

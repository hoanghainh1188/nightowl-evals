import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDigestCommand } from '../../src/commands/digest.js';
import { openStore } from '../../src/storage/store.js';
import { createFakeIo } from '../helpers/fake-io.js';
import { seed } from '../helpers/seed-failures.js';
import { createFakeRepo, type TempDir } from '../helpers/temp-repo.js';

describe('nightowl digest', () => {
  let repo: TempDir;
  beforeEach(async () => {
    repo = await createFakeRepo();
  });
  afterEach(() => repo.cleanup());

  async function run(args: readonly string[] = []) {
    const fake = createFakeIo();
    const code = await createDigestCommand({
      cwd: () => repo.path,
      now: () => new Date('2026-11-12T12:00:00.000Z'),
    }).run(args, fake.io);
    return { code, out: fake.out(), err: fake.err() };
  }

  it('errors when NightOwl is not initialized', async () => {
    const result = await run();
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/init/i);
  });

  it('rejects invalid --since', async () => {
    await seed(repo.path, []);
    const result = await run(['--since', 'nope']);
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/since/i);
  });

  it('rejects unknown --workspace', async () => {
    await seed(repo.path, [{ filePath: 'src/a.ts' }]);
    const result = await run(['--workspace', 'missing-pkg']);
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/unknown --workspace/);
  });

  it('prints markdown with totals and flagged, and does not change the DB', async () => {
    await seed(repo.path, [
      { filePath: 'src/a.ts', category: 'logic', status: 'flagged', createdAt: '2026-11-10T00:00:00.000Z' },
      { filePath: 'src/b.ts', category: 'convention', status: 'flagged', createdAt: '2026-11-10T00:00:00.000Z' },
      { filePath: 'src/c.ts', category: 'logic', status: 'dismissed', createdAt: '2026-11-10T00:00:00.000Z' },
    ]);
    const db = join(repo.path, '.nightowl/nightowl.db');
    const before = await readFile(db);

    const result = await run(['--since', '7d']);
    expect(result.code).toBe(0);
    expect(result.out).toContain('New failures (not dismissed): **2**');
    expect(result.out).toContain('Open for review (flagged): **2**');
    expect(result.out).toContain('logic: 1');
    expect(result.out).toContain('convention: 1');
    expect(result.out).toMatch(/Does not email\/Slack/i);
    expect(result.out).toContain('Rule impact: none recorded');
    expect(result.out).toContain('Eval loop: none recorded');

    expect((await readFile(db)).equals(before)).toBe(true);
    expect(await run(['--since', '7d'])).toMatchObject({ code: 0 });
    expect((await readFile(db)).equals(before)).toBe(true);
  });

  it('writes self-contained HTML by default path', async () => {
    await seed(repo.path, [
      { filePath: 'src/a.ts', category: 'logic', status: 'flagged', createdAt: '2026-11-10T00:00:00.000Z' },
    ]);
    const result = await run(['--format', 'html']);
    expect(result.code).toBe(0);
    expect(result.out).toMatch(/Wrote digest to/);
    const html = await readFile(join(repo.path, '.nightowl/digest.html'), 'utf8');
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('flagged');
    expect(html).not.toMatch(/https?:\/\//);
  });

  it('help mentions no email/Slack and eval-loop', () => {
    expect(createDigestCommand().help).toMatch(/email|Slack/i);
    expect(createDigestCommand().help).toContain('--config');
    expect(createDigestCommand().help).toMatch(/eval-loop|runs/i);
  });

  it('includes labeled eval loop from .nightowl/runs/', async () => {
    await seed(repo.path, [
      { filePath: 'src/a.ts', category: 'logic', status: 'flagged', createdAt: '2026-11-10T00:00:00.000Z' },
    ]);
    const runs = join(repo.path, '.nightowl', 'runs');
    await mkdir(runs, { recursive: true });
    await writeFile(
      join(runs, 'run.jsonl'),
      [
        JSON.stringify({
          schema: 'nightowl.eval-run-meta/v1',
          label: 'prompt-v3',
          models: ['haiku'],
          run_at: '2026-11-14T10:00:00.000Z',
        }),
        JSON.stringify({
          run_at: '2026-11-14T10:00:00.000Z',
          case_id: 'c1',
          model: 'haiku',
          coverage: 0.9,
          repeat: 0,
          score: 0.9,
          pass: true,
          tests_passed: null,
          error: null,
        }),
      ].join('\n') + '\n',
    );
    const result = await run(['--since', '7d']);
    expect(result.code).toBe(0);
    expect(result.out).toContain('Eval loop: prompt-v3');
  });

  it('uses digest.lookbackDays from config when --since is omitted', async () => {
    await seed(repo.path, [
      { filePath: 'src/old.ts', category: 'logic', createdAt: '2026-10-01T00:00:00.000Z' },
      { filePath: 'src/new.ts', category: 'logic', createdAt: '2026-11-11T00:00:00.000Z' },
    ]);
    await writeFile(
      join(repo.path, 'nightowl.config.json'),
      JSON.stringify({ version: 1, digest: { lookbackDays: 2 } }),
    );
    const withConfig = await run();
    expect(withConfig.code).toBe(0);
    expect(withConfig.out).toContain('since 2026-11-10');
    expect(withConfig.out).toMatch(/New failures \(not dismissed\): \*\*1\*\*/);

    const wider = await run(['--since', '2026-09-01']);
    expect(wider.code).toBe(0);
    expect(wider.out).toMatch(/New failures \(not dismissed\): \*\*2\*\*/);
  });
});

describe('buildDigest with signals', () => {
  it('counts signal events in the window', async () => {
    const repo = await createFakeRepo();
    try {
      await seed(repo.path, [
        { filePath: 'src/a.ts', category: 'logic', status: 'flagged', createdAt: '2026-11-10T00:00:00.000Z' },
      ]);
      const store = await openStore({ cwd: repo.path });
      store.insertEvent({
        source: 'ci',
        kind: 'ci-fail',
        dedupeKey: 'ci:digest-1',
        payload: { test_name: 't' },
        createdAt: '2026-11-10T00:00:00.000Z',
      });
      store.close();

      const fake = createFakeIo();
      const code = await createDigestCommand({
        cwd: () => repo.path,
        now: () => new Date('2026-11-12T12:00:00.000Z'),
      }).run(['--since', '2026-11-01'], fake.io);
      expect(code).toBe(0);
      expect(fake.out()).toContain('ci-fail 1');
    } finally {
      await repo.cleanup();
    }
  });
});

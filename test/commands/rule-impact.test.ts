import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRuleImpactCommand } from '../../src/commands/rule-impact.js';
import { openStore } from '../../src/storage/store.js';
import { createFakeIo } from '../helpers/fake-io.js';
import { seed } from '../helpers/seed-failures.js';
import { createFakeRepo, type TempDir } from '../helpers/temp-repo.js';

describe('nightowl rule-impact', () => {
  let repo: TempDir;
  beforeEach(async () => {
    repo = await createFakeRepo();
  });
  afterEach(() => repo.cleanup());

  async function run(args: readonly string[], now = new Date('2026-11-10T12:00:00.000Z')) {
    const fake = createFakeIo();
    const code = await createRuleImpactCommand({ cwd: () => repo.path, now: () => now }).run(args, fake.io);
    return { code, out: fake.out(), err: fake.err() };
  }

  it('errors when not initialized', async () => {
    const result = await run(['mark', '--label', 'r1']);
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/init/i);
  });

  it('marks baseline and compares before/after', async () => {
    await seed(repo.path, [
      { filePath: 'src/a.ts', category: 'convention', createdAt: '2026-10-20T00:00:00.000Z' },
      { filePath: 'src/b.ts', category: 'convention', createdAt: '2026-10-25T00:00:00.000Z' },
      { filePath: 'src/c.ts', category: 'convention', createdAt: '2026-10-28T00:00:00.000Z' },
      { filePath: 'src/d.ts', category: 'convention', createdAt: '2026-10-30T00:00:00.000Z' },
      { filePath: 'src/e.ts', category: 'convention', createdAt: '2026-11-05T00:00:00.000Z' },
    ]);
    const mark = await run(['mark', '--label', 'convention-naming', '--category', 'convention', '--at', '2026-11-01']);
    expect(mark.code).toBe(0);
    expect(mark.out).toMatch(/baseline_total=4/);

    const show = await run(['--json', '--before-days', '14', '--after-days', '14']);
    expect(show.code).toBe(0);
    const json = JSON.parse(show.out);
    expect(json.label).toBe('convention-naming');
    expect(json.before.total).toBe(4);
    expect(json.after.total).toBe(1);
    expect(json.delta).toBe(-3);

    // upsert same label
    expect(await run(['mark', '--label', 'convention-naming', '--category', 'convention', '--at', '2026-11-01'])).toMatchObject({
      code: 0,
    });
    const store = await openStore({ cwd: repo.path, readOnly: true });
    try {
      expect(store.listRuleApplications()).toHaveLength(1);
    } finally {
      store.close();
    }
  });

  it('counts null-category failures under --category unclassified', async () => {
    await seed(repo.path, [
      { filePath: 'src/x.ts', category: null, createdAt: '2026-10-25T00:00:00.000Z' },
      { filePath: 'src/y.ts', category: 'convention', createdAt: '2026-10-25T00:00:00.000Z' },
    ]);
    const mark = await run(['mark', '--label', 'null-cat', '--category', 'unclassified', '--at', '2026-11-01']);
    expect(mark.code).toBe(0);
    expect(mark.out).toMatch(/baseline_total=1/);

    const show = await run(['--json', '--before-days', '14', '--after-days', '14']);
    expect(show.code).toBe(0);
    const json = JSON.parse(show.out) as { before: { total: number }; after: { total: number } };
    expect(json.before.total).toBe(1);
    expect(json.after.total).toBe(0);
  });

  it('fails show when nothing marked', async () => {
    (await openStore({ cwd: repo.path })).close();
    const result = await run([]);
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/no rule application/i);
  });
});

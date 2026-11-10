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

  it('rejects invalid mark/show options', async () => {
    (await openStore({ cwd: repo.path })).close();
    expect(await run(['mark'])).toMatchObject({ code: 1 });
    expect((await run(['mark', '--label', 'x', '--json'])).err).toMatch(/does not accept/);
    expect((await run(['mark', '--label', 'x', '--category', 'nope'])).err).toMatch(/unknown --category/);
    expect((await run(['mark', '--label', 'x', '--agent', 'nope'])).err).toMatch(/unknown --agent/);
    expect((await run(['mark', '--label', 'x', '--depth', '9'])).err).toMatch(/--depth/);
    expect((await run(['mark', '--label', 'x', '--at', ''])).err).toMatch(/--at/);
    expect((await run(['mark', '--label', 'x', '--at', 'not-a-date'])).err).toMatch(/invalid --at/);
    expect((await run(['--before-days', '0'])).err).toMatch(/--before-days/);
    expect((await run(['--after-days', '9999'])).err).toMatch(/--after-days/);
    expect((await run(['--category', 'convention'])).err).toMatch(/filters stored on the mark/);
    expect((await run(['--label', 'a', '--id', '1'])).err).toMatch(/either --label or --id/);
    expect((await run(['--id', '0'])).err).toMatch(/--id must be a positive/);
    expect((await run(['--bogus'])).code).toBe(1);
  });

  it('shows text output and selects by id/label', async () => {
    await seed(repo.path, [
      { filePath: 'pkg/a.ts', category: 'convention', createdAt: '2026-10-25T00:00:00.000Z', agent: 'cursor' },
      { filePath: 'other/b.ts', category: 'convention', createdAt: '2026-10-25T00:00:00.000Z', agent: 'claude-code' },
    ]);
    const mark = await run([
      'mark',
      '--label',
      'mod-filter',
      '--category',
      'convention',
      '--agent',
      'cursor',
      '--module',
      'pkg',
      '--depth',
      '1',
      '--at',
      '2026-11-01T00:00:00.000Z',
    ]);
    expect(mark.code).toBe(0);
    expect(mark.out).toMatch(/baseline_total=1/);

    const byLabel = await run(['--label', 'mod-filter']);
    expect(byLabel.code).toBe(0);
    expect(byLabel.out).toMatch(/NightOwl rule impact: mod-filter/);
    expect(byLabel.out).toMatch(/incomplete/i);

    const store = await openStore({ cwd: repo.path, readOnly: true });
    let id: number;
    try {
      id = store.getLatestRuleApplication()!.id;
    } finally {
      store.close();
    }
    const byId = await run(['--id', String(id), '--json']);
    expect(byId.code).toBe(0);
    expect(JSON.parse(byId.out).label).toBe('mod-filter');

    expect((await run(['--label', 'missing'])).err).toMatch(/no rule application/);
  });

  it('accepts ISO --at and defaults windows', async () => {
    await seed(repo.path, [{ filePath: 'src/a.ts', category: 'logic', createdAt: '2026-10-20T00:00:00.000Z' }]);
    const mark = await run(['mark', '--label', 'iso', '--at', '2026-11-01T15:30:00.000Z']);
    expect(mark.code).toBe(0);
    const show = await run(['--json'], new Date('2026-12-01T00:00:00.000Z'));
    expect(show.code).toBe(0);
    const json = JSON.parse(show.out) as { after: { incomplete: boolean }; before_days: number };
    expect(json.after.incomplete).toBe(false);
    expect(json.before_days).toBe(14);
  });
});

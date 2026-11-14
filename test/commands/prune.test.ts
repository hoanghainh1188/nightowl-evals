import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPruneCommand, type PruneDeps } from '../../src/commands/prune.js';
import { COMMAND_FLAGS } from '../../src/completion/catalog.js';
import type { PruneResult } from '../../src/storage/prune.js';
import type { Store } from '../../src/storage/store.js';
import { createFakeIo } from '../helpers/fake-io.js';
import { createFakeRepo, type TempDir } from '../helpers/temp-repo.js';

describe('nightowl prune', () => {
  let repo: TempDir;

  beforeEach(async () => {
    repo = await createFakeRepo();
  });

  afterEach(async () => {
    await repo.cleanup();
  });

  function createTestDeps(overrides: Partial<PruneDeps> = {}): {
    deps: PruneDeps;
    fakeStore: {
      pruneCalls: any[];
      vacuumCalls: number;
      closed: boolean;
    };
  } {
    const fakeStore = {
      pruneCalls: [] as any[],
      vacuumCalls: 0,
      closed: false,
    };

    const mockStore = {
      root: repo.path,
      prune: (options: any): PruneResult => {
        fakeStore.pruneCalls.push(options);
        return {
          cutoffDate: '2026-10-10T00:00:00.000Z',
          snapshotsPruned: 5,
          bytesEstimated: 1200,
        };
      },
      vacuum: () => {
        fakeStore.vacuumCalls += 1;
      },
      close: () => {
        fakeStore.closed = true;
      },
    } as unknown as Store;

    const deps: PruneDeps = {
      cwd: () => repo.path,
      now: () => new Date('2026-11-09T00:00:00.000Z'),
      openStore: async () => mockStore,
      statFile: async () => ({ size: 10_000 }),
      ...overrides,
    };

    return { deps, fakeStore };
  }

  async function runPrune(args: readonly string[] = [], deps: PruneDeps) {
    const fake = createFakeIo();
    const cmd = createPruneCommand(deps);
    const code = await cmd.run(args, fake.io);
    return { code, out: fake.out(), err: fake.err() };
  }

  it('prints help text with --help', async () => {
    const { deps } = createTestDeps();
    const cmd = createPruneCommand(deps);
    expect(cmd.help).toContain('Usage: nightowl prune');
    expect(cmd.help).toContain('--days');
    expect(cmd.help).toContain('--profile');
    expect(cmd.help).toContain('--dry-run');
    expect(cmd.help).toContain('--vacuum');
    expect(cmd.help).toContain('--config');
    expect(cmd.help).toMatch(/bytes|size/i);
  });

  it('uses prune.profile from config when flags are omitted', async () => {
    await writeFile(
      join(repo.path, 'nightowl.config.json'),
      JSON.stringify({ version: 1, prune: { profile: 'short' } }),
    );
    const { deps, fakeStore } = createTestDeps();
    const { code, out } = await runPrune(['--dry-run'], deps);
    expect(code).toBe(0);
    expect(fakeStore.pruneCalls[0].olderThanDays).toBe(7);
    expect(out).toContain('7 day');
  });

  it('lists --profile in completion catalog', () => {
    expect(COMMAND_FLAGS.prune).toContain('--profile');
  });

  it('rejects invalid --days values with exit code 1', async () => {
    const { deps } = createTestDeps();
    const res1 = await runPrune(['--days', '0'], deps);
    expect(res1.code).toBe(1);
    expect(res1.err).toContain('--days must be a whole number greater than 0');

    const res2 = await runPrune(['--days=-5'], deps);
    expect(res2.code).toBe(1);
    expect(res2.err).toContain('--days must be a whole number greater than 0');

    const res3 = await runPrune(['--days', 'abc'], deps);
    expect(res3.code).toBe(1);
    expect(res3.err).toContain('--days must be a whole number greater than 0');
  });

  it('rejects unknown --profile', async () => {
    const { deps } = createTestDeps();
    const result = await runPrune(['--profile', 'nope'], deps);
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/--profile must be one of/);
  });

  it('prunes snapshots with default 30 days and reports bytes', async () => {
    const { deps, fakeStore } = createTestDeps();
    const { code, out, err } = await runPrune([], deps);

    expect(code).toBe(0);
    expect(err).toBe('');
    expect(out).toContain(
      'Pruned 5 snapshots (~1200 bytes of snapshot data) (older than 30 days, before 2026-10-10T00:00:00.000Z).',
    );
    expect(fakeStore.pruneCalls).toHaveLength(1);
    expect(fakeStore.pruneCalls[0].olderThanDays).toBe(30);
    expect(fakeStore.pruneCalls[0].dryRun).toBe(false);
    expect(fakeStore.vacuumCalls).toBe(0);
    expect(fakeStore.closed).toBe(true);
  });

  it('applies --profile short as 7 days', async () => {
    const { deps, fakeStore } = createTestDeps();
    const { code, out } = await runPrune(['--profile', 'short'], deps);
    expect(code).toBe(0);
    expect(out).toContain('older than 7 days');
    expect(fakeStore.pruneCalls[0].olderThanDays).toBe(7);
  });

  it('lets --days override --profile with a warning', async () => {
    const { deps, fakeStore } = createTestDeps();
    const { code, out, err } = await runPrune(['--profile', 'long', '--days', '14'], deps);
    expect(code).toBe(0);
    expect(err).toMatch(/--days 14 overrides --profile long/);
    expect(out).toContain('older than 14 days');
    expect(fakeStore.pruneCalls[0].olderThanDays).toBe(14);
  });

  it('supports custom --days option', async () => {
    const { deps, fakeStore } = createTestDeps();
    const { code, out } = await runPrune(['--days', '7'], deps);

    expect(code).toBe(0);
    expect(out).toContain('Pruned 5 snapshots (~1200 bytes of snapshot data) (older than 7 days');
    expect(fakeStore.pruneCalls[0].olderThanDays).toBe(7);
  });

  it('supports --dry-run option without mutating database', async () => {
    const { deps, fakeStore } = createTestDeps();
    const { code, out, err } = await runPrune(['--dry-run'], deps);

    expect(code).toBe(0);
    expect(err).toBe('');
    expect(out).toContain('Dry-run: 5 snapshots (~1200 bytes of snapshot data) would be pruned');
    expect(fakeStore.pruneCalls[0].dryRun).toBe(true);
    expect(fakeStore.vacuumCalls).toBe(0);
  });

  it('skips vacuum on --dry-run --vacuum with a warning', async () => {
    const { deps, fakeStore } = createTestDeps();
    const { code, out, err } = await runPrune(['--dry-run', '--vacuum'], deps);
    expect(code).toBe(0);
    expect(out).toContain('Dry-run:');
    expect(err).toMatch(/--vacuum skipped in dry-run/);
    expect(fakeStore.vacuumCalls).toBe(0);
  });

  it('supports --vacuum option and reports database size before/after', async () => {
    let calls = 0;
    const { deps, fakeStore } = createTestDeps({
      statFile: async () => {
        calls += 1;
        return { size: calls === 1 ? 10_000 : 8_000 };
      },
    });
    const { code, out } = await runPrune(['--vacuum'], deps);

    expect(code).toBe(0);
    expect(out).toContain('Pruned 5 snapshots');
    expect(out).toContain('Database vacuum completed (10000 → 8000 bytes, -2000).');
    expect(fakeStore.vacuumCalls).toBe(1);
  });

  it('handles single snapshot grammatical formatting', async () => {
    const { deps } = createTestDeps({
      openStore: async () =>
        ({
          root: repo.path,
          prune: () => ({ cutoffDate: '2026-10-10', snapshotsPruned: 1, bytesEstimated: 1 }),
          close: () => {},
        }) as unknown as Store,
    });
    const { out } = await runPrune(['--days', '1'], deps);
    expect(out).toContain(
      'Pruned 1 snapshot (~1 byte of snapshot data) (older than 1 day, before 2026-10-10).',
    );
  });

  it('fails with exit code 1 when store cannot be opened', async () => {
    const { deps } = createTestDeps({
      openStore: async () => 'NightOwl is not set up in this project. Run nightowl init first.',
    });
    const { code, err } = await runPrune([], deps);

    expect(code).toBe(1);
    expect(err).toContain('nightowl prune: NightOwl is not set up in this project');
  });
});

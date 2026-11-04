import { spawnSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isSqliteExperimentalWarning } from '../../src/storage/sqlite.js';
import { buildProbe } from '../helpers/build-probe.js';
import { createFakeRepo, type TempDir } from '../helpers/temp-repo.js';

describe('isSqliteExperimentalWarning', () => {
  it('matches the SQLite experimental warning in both call shapes', () => {
    const message = 'SQLite is an experimental feature and might change at any time';
    expect(isSqliteExperimentalWarning(message, ['ExperimentalWarning'])).toBe(true);
    expect(isSqliteExperimentalWarning(message, [{ type: 'ExperimentalWarning' }])).toBe(true);
    const error = Object.assign(new Error(message), { name: 'ExperimentalWarning' });
    expect(isSqliteExperimentalWarning(error, [])).toBe(true);
  });

  it('lets every other warning through', () => {
    expect(isSqliteExperimentalWarning('SQLite is an experimental feature', ['DeprecationWarning'])).toBe(false);
    expect(isSqliteExperimentalWarning('Fetch is experimental', ['ExperimentalWarning'])).toBe(false);
    expect(isSqliteExperimentalWarning('plain warning', [])).toBe(false);
  });
});

describe('opening a store in a fresh process', () => {
  let probe: Awaited<ReturnType<typeof buildProbe>>;
  let repo: TempDir;

  beforeAll(async () => {
    probe = await buildProbe('open-store');
    repo = await createFakeRepo();
  }, 60_000);

  afterAll(async () => {
    await probe.cleanup();
    await repo.cleanup();
  });

  it('prints nothing, not even the SQLite ExperimentalWarning', () => {
    const result = spawnSync(process.execPath, [probe.file, repo.path, '1'], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });

  it('still prints unrelated warnings after the store is opened', () => {
    const result = spawnSync(process.execPath, [probe.file, repo.path, '0', 'probe', 'keep me'], {
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toContain('keep me');
    expect(result.stderr).not.toContain('SQLite');
  });
});

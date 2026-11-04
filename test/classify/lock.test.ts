import { writeFileSync } from 'node:fs';
import { chmod, mkdir, readdir, readFile, stat, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { acquireClassifyLock, ClassifyLockError, LOCK_FILE } from '../../src/classify/lock.js';
import { createFakeRepo, type TempDir } from '../helpers/temp-repo.js';

describe('classify lock', () => {
  let repo: TempDir;
  const lockPath = () => join(repo.path, '.nightowl', LOCK_FILE);
  const exists = () => readFile(lockPath()).then(() => true, () => false);

  beforeEach(async () => {
    repo = await createFakeRepo();
    await mkdir(join(repo.path, '.nightowl'), { mode: 0o700 });
  });
  afterEach(() => repo.cleanup());

  const deps = (pid: number, alive: readonly number[] = [], onCheck: (other: number) => void = () => {}) => ({
    pid,
    isAlive: (other: number) => {
      onCheck(other);
      return alive.includes(other);
    },
    now: () => new Date('2026-11-05T10:00:00.000Z'),
  });

  it('writes our pid privately and removes the lock on release', async () => {
    const release = await acquireClassifyLock(repo.path, deps(100));
    expect(JSON.parse(await readFile(lockPath(), 'utf8'))).toEqual({ pid: 100, started_at: '2026-11-05T10:00:00.000Z' });
    expect((await stat(lockPath())).mode & 0o777).toBe(0o600);
    await release();
    expect(await exists()).toBe(false);
  });

  it('refuses while another live process holds the lock', async () => {
    await acquireClassifyLock(repo.path, deps(100));
    const error = await acquireClassifyLock(repo.path, deps(200, [100])).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ClassifyLockError);
    expect((error as Error).message).toContain('pid 100');
    expect((error as Error).message).toContain(lockPath());
    expect(JSON.parse(await readFile(lockPath(), 'utf8')).pid).toBe(100);
  });

  it.each([
    ['a process that has ended', JSON.stringify({ pid: 100, started_at: 'x' })],
    ['a broken lock file', 'not json'],
    ['a lock without a valid pid', JSON.stringify({ pid: -3 })],
  ])('replaces a lock left by %s', async (_label, content) => {
    await writeFile(lockPath(), content);
    const release = await acquireClassifyLock(repo.path, deps(200));
    expect(JSON.parse(await readFile(lockPath(), 'utf8')).pid).toBe(200);
    await release();
  });

  it('refuses a lock path that is a symlink, leaving it alone', async () => {
    await writeFile(join(repo.path, 'elsewhere'), 'keep');
    await symlink(join(repo.path, 'elsewhere'), lockPath());
    await expect(acquireClassifyLock(repo.path, deps(200))).rejects.toThrow(/symlink/);
    expect(await readFile(join(repo.path, 'elsewhere'), 'utf8')).toBe('keep');
  });

  it('never removes a lock that another process took over', async () => {
    const release = await acquireClassifyLock(repo.path, deps(100));
    await writeFile(lockPath(), JSON.stringify({ pid: 300 }));
    await release();
    expect(JSON.parse(await readFile(lockPath(), 'utf8')).pid).toBe(300);
  });

  it('leaves no temporary files behind', async () => {
    const release = await acquireClassifyLock(repo.path, deps(100));
    expect(await readdir(join(repo.path, '.nightowl'))).toEqual([LOCK_FILE]);
    await release();
    expect(await readdir(join(repo.path, '.nightowl'))).toEqual([]);
  });

  it('does not take over a lock another process took over first', async () => {
    await writeFile(lockPath(), JSON.stringify({ pid: 100 }));
    // While we judge pid 100 dead, another process replaces the stale lock with its own.
    const racing = deps(200, [300], (pid) => {
      if (pid === 100) writeFileSync(lockPath(), JSON.stringify({ pid: 300 }));
    });
    await expect(acquireClassifyLock(repo.path, racing)).rejects.toThrow(ClassifyLockError);
    expect(JSON.parse(await readFile(lockPath(), 'utf8')).pid).toBe(300);
    expect(await readdir(join(repo.path, '.nightowl'))).toEqual([LOCK_FILE]);
  });

  it('reports a folder it cannot write to as a lock error', async () => {
    await chmod(join(repo.path, '.nightowl'), 0o500);
    try {
      await expect(acquireClassifyLock(repo.path, deps(100))).rejects.toThrow(ClassifyLockError);
    } finally {
      await chmod(join(repo.path, '.nightowl'), 0o700);
    }
  });
});


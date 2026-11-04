import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { findProjectRoot } from '../../src/storage/project-root.js';
import { createFakeRepo, createTempDir, type TempDir } from '../helpers/temp-repo.js';

describe('findProjectRoot', () => {
  let dir: TempDir;
  afterEach(() => dir.cleanup());

  it('returns the directory that holds .git', async () => {
    dir = await createFakeRepo();
    expect(findProjectRoot(dir.path)).toBe(dir.path);
  });

  it('walks up from a nested directory', async () => {
    dir = await createFakeRepo();
    const nested = join(dir.path, 'src', 'feature');
    await mkdir(nested, { recursive: true });
    expect(findProjectRoot(nested)).toBe(dir.path);
  });

  it('accepts a .git file, as used by worktrees and submodules', async () => {
    dir = await createTempDir();
    await writeFile(join(dir.path, '.git'), 'gitdir: /elsewhere\n');
    expect(findProjectRoot(dir.path)).toBe(dir.path);
  });

  it('returns null outside any repository', async () => {
    dir = await createTempDir();
    expect(findProjectRoot(dir.path)).toBeNull();
  });
});

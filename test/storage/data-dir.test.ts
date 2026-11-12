import { mkdir, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DATA_DIR, DataDirError, ensureDataDir } from '../../src/storage/data-dir.js';
import { createTempDir, type TempDir } from '../helpers/temp-repo.js';

describe('ensureDataDir', () => {
  let dir: TempDir;

  beforeEach(async () => {
    dir = await createTempDir();
  });
  afterEach(() => dir.cleanup());

  it('creates .nightowl with 0700 on POSIX', () => {
    const path = ensureDataDir(dir.path, 'linux');
    expect(path).toBe(join(dir.path, DATA_DIR));
  });

  it('accepts win32 without failing on mode bits', () => {
    const path = ensureDataDir(dir.path, 'win32');
    expect(path).toBe(join(dir.path, DATA_DIR));
  });

  it('refuses a symlink .nightowl', async () => {
    const target = join(dir.path, 'elsewhere');
    await mkdir(target);
    await symlink(target, join(dir.path, DATA_DIR));
    expect(() => ensureDataDir(dir.path, 'linux')).toThrow(DataDirError);
  });
});

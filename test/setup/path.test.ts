import { chmod, writeFile } from 'node:fs/promises';
import { delimiter, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isOnPath } from '../../src/setup/path.js';
import { createTempDir, type TempDir } from '../helpers/temp-repo.js';

describe('isOnPath', () => {
  let dir: TempDir;
  beforeEach(async () => {
    dir = await createTempDir();
  });
  afterEach(() => dir.cleanup());

  it('finds an executable in PATH', async () => {
    await writeFile(join(dir.path, 'nightowl'), '#!/bin/sh\n');
    await chmod(join(dir.path, 'nightowl'), 0o755);
    expect(isOnPath('nightowl', `/nope${delimiter}${dir.path}`)).toBe(true);
  });

  it('ignores files that are not executable, and empty PATH', async () => {
    await writeFile(join(dir.path, 'nightowl'), '#!/bin/sh\n');
    expect(isOnPath('nightowl', dir.path)).toBe(false);
    expect(isOnPath('nightowl', undefined)).toBe(false);
  });
});

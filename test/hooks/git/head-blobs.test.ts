import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readBlobIds, resolveHead } from '../../../src/hooks/git/head-blobs.js';
import { createGitRepo, git } from '../../helpers/git-repo.js';
import { type TempDir, writeFiles } from '../../helpers/temp-repo.js';

describe('blob ids in a commit', () => {
  let repo: TempDir;
  beforeEach(async () => {
    repo = await createGitRepo();
  });
  afterEach(() => repo.cleanup());

  it('resolves HEAD to a commit sha', async () => {
    expect(await resolveHead(repo.path)).toBe(git(repo.path, ['rev-parse', 'HEAD']).trim());
  });

  it('returns the blob of each committed file, including spaces and Unicode, and skips missing ones', async () => {
    await writeFiles(repo.path, { 'a.ts': 'a\n', 'src/my file.ts': 'b\n', 'src/đơn hàng.ts': 'c\n' });
    git(repo.path, ['add', '.']);
    git(repo.path, ['commit', '-q', '-m', 'files']);
    const head = await resolveHead(repo.path);
    const blobs = await readBlobIds(repo.path, head, ['a.ts', 'missing.ts', 'src/my file.ts', 'src/đơn hàng.ts']);
    expect(blobs.get('a.ts')).toBe(git(repo.path, ['rev-parse', 'HEAD:a.ts']).trim());
    expect(blobs.get('src/my file.ts')).toBe(git(repo.path, ['rev-parse', 'HEAD:src/my file.ts']).trim());
    expect(blobs.get('src/đơn hàng.ts')).toBe(git(repo.path, ['rev-parse', 'HEAD:src/đơn hàng.ts']).trim());
    expect(blobs.has('missing.ts')).toBe(false);
  });

  it('ignores directories and paths it cannot pass to git', async () => {
    await writeFiles(repo.path, { 'src/a.ts': 'a\n' });
    git(repo.path, ['add', '.']);
    git(repo.path, ['commit', '-q', '-m', 'files']);
    const blobs = await readBlobIds(repo.path, await resolveHead(repo.path), ['src', 'bad\nname.ts']);
    expect(blobs.size).toBe(0);
  });

  it('returns nothing for no paths', async () => {
    expect((await readBlobIds(repo.path, await resolveHead(repo.path), [])).size).toBe(0);
  });
});

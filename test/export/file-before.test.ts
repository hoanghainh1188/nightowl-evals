import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fileBeforeKey, MAX_FILE_BEFORE_BYTES, readFilesBefore } from '../../src/export/file-before.js';
import { createGitRepo, git } from '../helpers/git-repo.js';
import { type TempDir, writeFiles } from '../helpers/temp-repo.js';

describe('readFilesBefore', () => {
  let repo: TempDir;
  beforeEach(async () => {
    repo = await createGitRepo();
  });
  afterEach(() => repo.cleanup());

  async function commit(files: Record<string, string>): Promise<string> {
    await writeFiles(repo.path, files);
    git(repo.path, ['add', '-A']);
    git(repo.path, ['commit', '-q', '-m', 'x']);
    return git(repo.path, ['rev-parse', 'HEAD']).trim();
  }

  it('reads each file as it was in the parent commit, including odd names', async () => {
    await commit({ 'src/a.ts': 'v0\n', 'src/my file.ts': 's0\n', 'src/đơn hàng.ts': 'u0\n' });
    const sha = await commit({ 'src/a.ts': 'v2\n', 'src/my file.ts': 's2\n', 'src/đơn hàng.ts': 'u2\n', 'src/new.ts': 'n\n' });
    const items = ['src/a.ts', 'src/my file.ts', 'src/đơn hàng.ts', 'src/new.ts'].map((filePath) => ({ commitSha: sha, filePath }));
    const files = await readFilesBefore(repo.path, items);
    expect(files.get(fileBeforeKey({ commitSha: sha, filePath: 'src/a.ts' }))).toBe('v0\n');
    expect(files.get(fileBeforeKey({ commitSha: sha, filePath: 'src/my file.ts' }))).toBe('s0\n');
    expect(files.get(fileBeforeKey({ commitSha: sha, filePath: 'src/đơn hàng.ts' }))).toBe('u0\n');
    expect(files.has(fileBeforeKey({ commitSha: sha, filePath: 'src/new.ts' }))).toBe(false);
  });

  it('leaves out root commits, unknown commits, directories, odd shas and large files', async () => {
    const root = git(repo.path, ['rev-list', '--max-parents=0', 'HEAD']).trim();
    await commit({ 'big.txt': 'x'.repeat(MAX_FILE_BEFORE_BYTES + 1), 'dir/a.ts': 'a\n' });
    const sha = await commit({ 'big.txt': 'y', 'dir/a.ts': 'b\n' });
    const files = await readFilesBefore(repo.path, [
      { commitSha: root, filePath: 'a.ts' },
      { commitSha: 'f'.repeat(40), filePath: 'a.ts' },
      { commitSha: sha, filePath: 'dir' },
      { commitSha: 'HEAD', filePath: 'dir/a.ts' },
      { commitSha: sha, filePath: 'bad\nname' },
      { commitSha: sha, filePath: 'big.txt' },
      { commitSha: sha, filePath: 'dir/a.ts' },
    ]);
    expect([...files.values()]).toEqual(['a\n']);
  });

  it('leaves out binary and non-UTF-8 files, and reads a repeated item once', async () => {
    const { writeFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    await writeFile(join(repo.path, 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1]));
    await writeFile(join(repo.path, 'latin1.txt'), Buffer.from([0x63, 0x61, 0x66, 0xe9, 0x0a]));
    await commit({ 'a.ts': 'v0\n' });
    const sha = await commit({ 'logo.png': 'x', 'latin1.txt': 'y', 'a.ts': 'v1\n' });
    const files = await readFilesBefore(repo.path, [
      { commitSha: sha, filePath: 'logo.png' },
      { commitSha: sha, filePath: 'latin1.txt' },
      { commitSha: sha, filePath: 'a.ts' },
      { commitSha: sha, filePath: 'a.ts' },
    ]);
    expect([...files.entries()]).toEqual([[fileBeforeKey({ commitSha: sha, filePath: 'a.ts' }), 'v0\n']]);
  });

  it('returns nothing for no items', async () => {
    expect((await readFilesBefore(repo.path, [])).size).toBe(0);
  });
});

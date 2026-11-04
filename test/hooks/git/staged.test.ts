import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { listStagedFiles, readStagedFiles } from '../../../src/hooks/git/staged.js';
import { createGitRepo, git } from '../../helpers/git-repo.js';
import { type TempDir, writeFiles } from '../../helpers/temp-repo.js';

describe('staged files', () => {
  let repo: TempDir;
  beforeEach(async () => {
    repo = await createGitRepo();
  });
  afterEach(() => repo.cleanup());

  it('lists added and modified files, including spaces and Unicode, but not deletions', async () => {
    await writeFiles(repo.path, { 'gone.ts': 'x', 'kept.ts': 'v1' });
    git(repo.path, ['add', '.']);
    git(repo.path, ['commit', '-q', '-m', 'base']);
    await writeFiles(repo.path, { 'kept.ts': 'v2', 'src/my file.ts': 'a', 'src/đơn hàng.ts': 'b', 'unstaged.ts': 'c' });
    git(repo.path, ['rm', '-q', 'gone.ts']);
    git(repo.path, ['add', 'kept.ts', 'src']);
    expect([...(await listStagedFiles(repo.path))].sort()).toEqual(['kept.ts', 'src/my file.ts', 'src/đơn hàng.ts']);
  });

  it('reads the staged content, not the working tree', async () => {
    await writeFiles(repo.path, { 'a.ts': 'staged\n', 'b.ts': 'second\n' });
    git(repo.path, ['add', '.']);
    await writeFiles(repo.path, { 'a.ts': 'working tree\n' });
    const files = await readStagedFiles(repo.path, ['a.ts', 'b.ts']);
    expect(files.get('a.ts')?.content).toBe('staged\n');
    expect(files.get('a.ts')?.blob).toMatch(/^[0-9a-f]{40,64}$/);
    expect(files.get('b.ts')?.content).toBe('second\n');
  });

  it('skips paths that are not staged', async () => {
    const files = await readStagedFiles(repo.path, ['missing.ts']);
    expect(files.size).toBe(0);
  });

  it('returns nothing for an empty list without calling git', async () => {
    expect((await readStagedFiles('/nonexistent', [])).size).toBe(0);
  });
});

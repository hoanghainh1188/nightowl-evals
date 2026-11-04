import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { unifiedDiff } from '../../src/classify/diff.js';
import { createTempDir, type TempDir } from '../helpers/temp-repo.js';

describe('unifiedDiff', () => {
  it('is empty for identical content', () => {
    expect(unifiedDiff('a\nb\n', 'a\nb\n')).toBe('');
    expect(unifiedDiff('', '')).toBe('');
  });

  it('shows a modified line with context', () => {
    expect(unifiedDiff('a\nb\nc\n', 'a\nB\nc\n')).toBe('--- ai\n+++ dev\n@@ -1,3 +1,3 @@\n a\n-b\n+B\n c\n');
  });

  it('shows added and removed lines', () => {
    expect(unifiedDiff('a\n', 'a\nb\n')).toBe('--- ai\n+++ dev\n@@ -1 +1,2 @@\n a\n+b\n');
    expect(unifiedDiff('a\nb\n', 'b\n')).toBe('--- ai\n+++ dev\n@@ -1,2 +1 @@\n-a\n b\n');
  });

  it('handles empty files', () => {
    expect(unifiedDiff('', 'x\n')).toBe('--- ai\n+++ dev\n@@ -0,0 +1 @@\n+x\n');
    expect(unifiedDiff('x\n', '')).toBe('--- ai\n+++ dev\n@@ -1 +0,0 @@\n-x\n');
  });

  it('marks a missing final newline', () => {
    expect(unifiedDiff('a\nb', 'a\nb\n')).toBe(
      '--- ai\n+++ dev\n@@ -1,2 +1,2 @@\n a\n-b\n\\ No newline at end of file\n+b\n',
    );
  });

  it('keeps changes far apart in separate hunks', () => {
    const before = Array.from({ length: 20 }, (_, i) => `l${i}`).join('\n') + '\n';
    const after = before.replace('l1\n', 'L1\n').replace('l18\n', 'L18\n');
    expect((unifiedDiff(before, after) ?? '').match(/^@@/gm)).toHaveLength(2);
  });

  it('gives up with null when the files differ too much', () => {
    const a = Array.from({ length: 3000 }, (_, i) => `a${i}`).join('\n');
    const b = Array.from({ length: 3000 }, (_, i) => `b${i}`).join('\n');
    expect(unifiedDiff(a, b, { maxEdits: 1000 })).toBeNull();
  });

  describe('agrees with git diff', () => {
    let dir: TempDir;
    beforeEach(async () => {
      dir = await createTempDir();
    });
    afterEach(() => dir.cleanup());

    it.each([
      ['middle edit', 'a\nb\nc\nd\ne\nf\ng\nh\n', 'a\nb\nc\nX\ne\nf\ng\nh\n'],
      ['moved block', 'one\ntwo\nthree\nfour\nfive\n', 'three\nfour\none\ntwo\nfive\n'],
      ['mixed', 'x\ny\nz\n', 'w\nx\nz\nq\n'],
    ])('%s', async (_label, before, after) => {
      await writeFile(join(dir.path, 'ai'), before);
      await writeFile(join(dir.path, 'dev'), after);
      let expected = '';
      try {
        execFileSync('git', ['diff', '--no-index', '--no-color', '--diff-algorithm=myers', 'ai', 'dev'], {
          cwd: dir.path,
          encoding: 'utf8',
        });
      } catch (error) {
        expected = (error as { stdout: string }).stdout;
      }
      // Count the changed lines only: git and NightOwl may place equal-cost edits differently.
      const changed = (diff: string) => diff.split('\n').filter((l) => /^[-+](?![-+]{2} )/.test(l)).length;
      expect(changed(unifiedDiff(before, after) ?? '')).toBe(changed(expected));
    });
  });
});

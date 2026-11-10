import { describe, expect, it } from 'vitest';
import { filePatch } from '../../src/export/file-patch.js';

describe('filePatch', () => {
  it('builds a unified diff from file_before to expected', () => {
    const patch = filePatch('src/a.ts', 'line1\n', 'ai\n', 'line1\nline2\n');
    expect(patch).toContain('--- a/src/a.ts');
    expect(patch).toContain('+++ b/src/a.ts');
    expect(patch).toContain('+line2');
  });

  it('falls back to rejected when file_before is null', () => {
    const patch = filePatch('b.ts', null, 'bad\n', 'good\n');
    expect(patch).toContain('--- a/b.ts');
    expect(patch).toContain('-bad');
    expect(patch).toContain('+good');
  });
});

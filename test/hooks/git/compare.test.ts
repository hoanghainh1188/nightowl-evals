import { describe, expect, it } from 'vitest';
import { compareContent } from '../../../src/hooks/git/compare.js';

describe('compareContent', () => {
  it('reports unchanged for identical content', () => {
    expect(compareContent('a\nb\n', 'a\nb\n')).toEqual({
      outcome: 'unchanged',
      lines_added: 0,
      lines_removed: 0,
      whitespace_only: false,
    });
  });

  it('counts added and removed lines', () => {
    expect(compareContent('a\nb\nc\n', 'a\nB\nc\nd\n')).toEqual({
      outcome: 'modified',
      lines_added: 2,
      lines_removed: 1,
      whitespace_only: false,
    });
  });

  it('counts repeated lines as a multiset', () => {
    expect(compareContent('x\nx\n', 'x\n')).toMatchObject({ lines_added: 0, lines_removed: 1 });
  });

  it('flags whitespace-only changes', () => {
    expect(compareContent('if (a) {\n  b();\n}\n', 'if (a) {\n    b();\n}\n')).toMatchObject({
      outcome: 'modified',
      whitespace_only: true,
    });
  });

  it('treats CRLF and LF line endings as whitespace', () => {
    expect(compareContent('a\nb\n', 'a\r\nb\r\n')).toMatchObject({ outcome: 'modified', whitespace_only: true });
  });
});

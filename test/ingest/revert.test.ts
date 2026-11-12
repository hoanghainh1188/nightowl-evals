import { describe, expect, it } from 'vitest';
import { parseRevertMessage, revertDedupeKey } from '../../src/ingest/revert.js';

describe('parseRevertMessage', () => {
  it('extracts the full SHA from a standard git revert body', () => {
    const sha = 'abcdef0123456789abcdef0123456789abcdef01';
    expect(
      parseRevertMessage(`Revert "fix bug"\n\nThis reverts commit ${sha}.\n`),
    ).toBe(sha);
  });

  it('is case-insensitive on the hex SHA', () => {
    expect(parseRevertMessage('This reverts commit ABCDEF0123456789ABCDEF0123456789ABCDEF01.')).toBe(
      'abcdef0123456789abcdef0123456789abcdef01',
    );
  });

  it('rejects messages without a full 40-hex SHA', () => {
    expect(parseRevertMessage('This reverts commit abcdef01.')).toBeNull();
    expect(parseRevertMessage('Revert "something"')).toBeNull();
    expect(parseRevertMessage('')).toBeNull();
  });
});

describe('revertDedupeKey', () => {
  it('is stable and lowercases both SHAs', () => {
    const a = 'ABCDEF0123456789ABCDEF0123456789ABCDEF01';
    const b = 'fedcba9876543210fedcba9876543210fedcba98';
    expect(revertDedupeKey(a, b)).toBe(
      'revert:abcdef0123456789abcdef0123456789abcdef01:fedcba9876543210fedcba9876543210fedcba98',
    );
    expect(revertDedupeKey(a.toLowerCase(), b.toLowerCase())).toBe(revertDedupeKey(a, b));
  });
});

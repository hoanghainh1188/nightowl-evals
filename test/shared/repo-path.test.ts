import { describe, expect, it } from 'vitest';
import { normalizeRepoPath } from '../../src/shared/repo-path.js';

describe('normalizeRepoPath', () => {
  it.each([
    ['src\\hooks\\a.ts', 'src/hooks/a.ts'],
    ['./src/hooks/a.ts', 'src/hooks/a.ts'],
    ['packages/ui/', 'packages/ui'],
    ['packages\\ui\\src\\Button.tsx', 'packages/ui/src/Button.tsx'],
    ['README.md', 'README.md'],
  ])('%j → %j', (input, expected) => {
    expect(normalizeRepoPath(input)).toBe(expected);
  });
});

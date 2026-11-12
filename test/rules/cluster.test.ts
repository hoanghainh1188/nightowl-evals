import { describe, expect, it } from 'vitest';
import { clusterFailures } from '../../src/rules/cluster.js';
import type { FailureForRules } from '../../src/rules/types.js';

function failure(partial: Partial<FailureForRules> & Pick<FailureForRules, 'id' | 'filePath'>): FailureForRules {
  return Object.freeze({
    category: 'convention',
    status: 'confirmed',
    agent: 'claude-code',
    aiContent: 'ai\n',
    finalContent: 'dev\n',
    categoryReason: null,
    ...partial,
  });
}

describe('clusterFailures', () => {
  it('groups by category, module, agent, and fingerprint and drops clusters below min-count', () => {
    const clusters = clusterFailures(
      [
        failure({ id: 1, filePath: 'src/auth/a.ts', category: 'convention', aiContent: 'same\n', finalContent: 'edit\n' }),
        failure({ id: 2, filePath: 'src/auth/b.ts', category: 'convention', aiContent: 'same\n', finalContent: 'edit\n' }),
        failure({ id: 3, filePath: 'src/auth/c.ts', category: 'logic', aiContent: 'same\n', finalContent: 'edit\n' }),
        failure({ id: 4, filePath: 'src/other/d.ts', category: 'convention', aiContent: 'same\n', finalContent: 'edit\n' }),
        failure({
          id: 5,
          filePath: 'src/auth/e.ts',
          category: 'convention',
          aiContent: 'other\n',
          finalContent: 'diff\n',
        }),
      ],
      { minCount: 2 },
    );
    expect(clusters.map((c) => [c.category, c.module, c.count])).toEqual([['convention', 'src/auth', 2]]);
  });

  it('merges two paths in the same module when fingerprints match', () => {
    const clusters = clusterFailures(
      [
        failure({ id: 1, filePath: 'src/auth/a.ts', aiContent: 'x\n', finalContent: 'y\n' }),
        failure({ id: 2, filePath: 'src/auth/b.ts', aiContent: 'x\n', finalContent: 'y\n' }),
      ],
      { minCount: 2 },
    );
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.count).toBe(2);
    expect(clusters[0]?.key).toContain('|');
  });

  it('sorts by count descending and respects limit', () => {
    const clusters = clusterFailures(
      [
        failure({ id: 1, filePath: 'a/x.ts', category: 'convention' }),
        failure({ id: 2, filePath: 'a/y.ts', category: 'convention' }),
        failure({ id: 3, filePath: 'a/z.ts', category: 'convention' }),
        failure({ id: 4, filePath: 'b/x.ts', category: 'missing-context' }),
        failure({ id: 5, filePath: 'b/y.ts', category: 'missing-context' }),
      ],
      { minCount: 2, limit: 1 },
    );
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.count).toBe(3);
  });
});

import { describe, expect, it } from 'vitest';
import { formatSuggestedRules, hasRulesMarker } from '../../src/rules/format.js';
import { buildHeuristicRules } from '../../src/rules/heuristic.js';
import type { FailureForRules } from '../../src/rules/types.js';
import { RULES_MARKER_START } from '../../src/rules/types.js';

function failure(partial: Partial<FailureForRules> & Pick<FailureForRules, 'id' | 'filePath'>): FailureForRules {
  return Object.freeze({
    category: 'convention',
    status: 'confirmed',
    agent: 'claude-code',
    aiContent: 'const x = 1\n',
    finalContent: 'const x = 1;\n',
    categoryReason: 'prefer semicolons',
    ...partial,
  });
}

describe('heuristic + format', () => {
  it('emits marker and omits secret snippets', () => {
    const secret = 'const key = "ghp_123456789012345678901234567890123456";\n';
    const rules = buildHeuristicRules(
      [
        failure({ id: 1, filePath: 'src/a.ts', aiContent: secret, finalContent: 'const key = process.env.KEY;\n' }),
        failure({ id: 2, filePath: 'src/b.ts', aiContent: secret, finalContent: 'const key = process.env.KEY;\n' }),
      ],
      { minCount: 2 },
    );
    expect(rules).toHaveLength(1);
    expect(rules[0]?.body).not.toContain('ghp_');
    expect(rules[0]?.body).toContain('secret-filtered');

    const md = formatSuggestedRules(rules, '2026-11-09T00:00:00.000Z');
    expect(hasRulesMarker(md)).toBe(true);
    expect(md.startsWith(RULES_MARKER_START)).toBe(true);
    expect(md).toContain('## 1. Follow project conventions');
    expect(md).not.toContain('ghp_');
  });

  it('formats empty output when nothing meets the threshold', () => {
    const md = formatSuggestedRules([], '2026-11-09T00:00:00.000Z');
    expect(md).toContain(RULES_MARKER_START);
    expect(md).toContain('No clusters met the threshold');
  });
});

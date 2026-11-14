import { describe, expect, it } from 'vitest';
import { classifyHeuristic } from '../../src/classify/heuristic.js';

describe('classifyHeuristic', () => {
  it('matches whitespace-only / CRLF changes as convention', () => {
    const result = classifyHeuristic({
      filePath: 'src/a.ts',
      aiContent: 'const x = 1;\r\n',
      finalContent: 'const x = 1;\n',
    });
    expect(result).toMatchObject({
      category: 'convention',
      ruleId: 'whitespace-only',
      confidence: 0.9,
    });
    expect(result?.reason.length).toBeGreaterThan(0);
  });

  it('matches import-or-path-only changes as missing-context', () => {
    const result = classifyHeuristic({
      filePath: 'src/a.ts',
      aiContent: `import { foo } from './old';\n\nexport const n = 1;\n`,
      finalContent: `import { foo } from './new';\n\nexport const n = 1;\n`,
    });
    expect(result).toMatchObject({
      category: 'missing-context',
      ruleId: 'import-or-path-only',
      confidence: 0.75,
    });
  });

  it('matches rename-identifier as convention', () => {
    const result = classifyHeuristic({
      filePath: 'src/a.ts',
      aiContent: 'function getUser() {\n  return user;\n}\n',
      finalContent: 'function fetchUser() {\n  return user;\n}\n',
    });
    expect(result).toMatchObject({
      category: 'convention',
      ruleId: 'rename-identifier',
      confidence: 0.7,
    });
  });

  it('matches prompt-mismatch-hint as misread-requirement when final is closer to prompt', () => {
    const result = classifyHeuristic({
      filePath: 'src/a.ts',
      userPrompt: 'validate email with regex',
      aiContent: 'function parseDate(input) {\n  return new Date(input);\n}\n',
      finalContent: 'function validate(email) {\n  return /regex/.test(email);\n}\n',
    });
    expect(result).toMatchObject({
      category: 'misread-requirement',
      ruleId: 'prompt-mismatch-hint',
      confidence: 0.65,
    });
  });

  it('returns null when no rule matches', () => {
    expect(
      classifyHeuristic({
        filePath: 'src/a.ts',
        aiContent: 'function add(a, b) {\n  return a - b;\n}\n',
        finalContent: 'function add(a, b) {\n  return a + b;\n}\n',
      }),
    ).toBeNull();
  });

  it('returns null when content is identical', () => {
    expect(
      classifyHeuristic({
        filePath: 'src/a.ts',
        aiContent: 'same\n',
        finalContent: 'same\n',
      }),
    ).toBeNull();
  });

  it('returns null when diff is omitted (too large)', () => {
    const ai = Array.from({ length: 3000 }, (_, i) => `a${i}`).join('\n');
    const final = Array.from({ length: 3000 }, (_, i) => `b${i}`).join('\n');
    expect(classifyHeuristic({ filePath: 'big.ts', aiContent: ai, finalContent: final })).toBeNull();
  });

  it('returns null for prompt-mismatch when prompt is empty', () => {
    expect(
      classifyHeuristic({
        filePath: 'src/a.ts',
        userPrompt: '',
        aiContent: 'function parseDate(input) {\n  return new Date(input);\n}\n',
        finalContent: 'function validate(email) {\n  return /regex/.test(email);\n}\n',
      }),
    ).toBeNull();
  });

  it('prefers whitespace-only over later rules', () => {
    const result = classifyHeuristic({
      filePath: 'src/a.ts',
      userPrompt: 'rename things',
      aiContent: 'import x from "a";\r\n',
      finalContent: 'import x from "a";\n',
    });
    expect(result?.ruleId).toBe('whitespace-only');
  });
});

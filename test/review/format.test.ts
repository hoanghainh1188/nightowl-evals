import { describe, expect, it } from 'vitest';
import { formatDetail, formatList, MAX_DIFF_LINE_CHARS, MAX_DIFF_LINES, terminalSafe } from '../../src/review/format.js';
import type { FailureForReview } from '../../src/storage/review-queries.js';

const failure = (overrides: Partial<FailureForReview> = {}): FailureForReview => ({
  id: 12,
  createdAt: '2026-11-05T09:30:00.000Z',
  filePath: 'src/age.ts',
  commitSha: '3f2a9c1d8e07aa55',
  source: 'ai-self-fix',
  status: 'flagged',
  category: 'logic',
  categoryReason: 'wrong boundary',
  categoryConfidence: 0.82,
  prompt: 'isAdult is true from 18',
  feedback: 'wrong, 18 counts as adult',
  aiContent: 'const isAdult = (age) => age > 18;\n',
  finalContent: 'const isAdult = (age) => age >= 18;\n',
  ...overrides,
});

describe('terminalSafe', () => {
  it('keeps tabs and newlines but drops escape sequences and carriage returns', () => {
    expect(terminalSafe('a\tb\r\n\u001b[2Jc\u0007')).toBe('a\tb\n?[2Jc?');
  });

  it('drops characters that reverse or hide text', () => {
    expect(terminalSafe('a\u202egnp.ts\u200b\u2066x')).toBe('a?gnp.ts??x');
  });
});

describe('formatList', () => {
  it('prints one line per failure with counts and the start of the prompt', () => {
    const text = formatList([failure(), failure({ id: 11, source: 'manual-fix', category: null, prompt: null })], 'flagged');
    const [first, second, footer] = text.trimEnd().split('\n');
    expect(first).toMatch(/^#12 +2026-11-05 +ai-self-fix +logic +src\/age\.ts +\+1 -1 +"isAdult is true from 18"$/);
    expect(second).toMatch(/^#11 +2026-11-05 +manual-fix +unclassified +src\/age\.ts +\+1 -1 +\(no prompt\)$/);
    expect(footer).toBe('2 flagged shown. Details: nightowl review show <id>');
  });

  it('cuts a long or multi-line prompt to one short line', () => {
    const line = formatList([failure({ prompt: `first line ${'é'.repeat(60)}\nsecond line` })], 'flagged');
    expect(line).toContain(`"first line ${'é'.repeat(29)}…"`);
    expect(line).not.toContain('second line');
  });

  it('keeps control characters of the repository off the terminal', () => {
    const line = formatList([failure({ filePath: 'x\u001b[2J.ts', prompt: 'p\u001b]0;t\u0007' })], 'flagged');
    expect(line).not.toMatch(/[\u0000-\u0008\u000b-\u001f\u007f]/);
  });

  it('says when nothing matches', () => {
    expect(formatList([], 'flagged')).toBe('No flagged failures. Try: nightowl review --status all\n');
    expect(formatList([], null)).toBe('No failures match.\n');
  });
});

describe('formatDetail', () => {
  it('shows the prompts, the classification and the diff', () => {
    const text = formatDetail(failure());
    expect(text).toContain('#12  ai-self-fix  flagged');
    expect(text).toContain('File      src/age.ts');
    expect(text).toContain('Commit    3f2a9c1d8e07  2026-11-05 09:30 UTC');
    expect(text).toContain('Category  logic (0.82): wrong boundary');
    expect(text).toContain('Prompt\n  isAdult is true from 18');
    expect(text).toContain('Feedback\n  wrong, 18 counts as adult');
    expect(text).toContain('  -const isAdult = (age) => age > 18;');
    expect(text).toContain('  +const isAdult = (age) => age >= 18;');
    expect(text).toContain('nightowl review confirm 12');
  });

  it('leaves out what was not recorded', () => {
    const text = formatDetail(failure({ feedback: null, prompt: null, category: null, categoryReason: null, categoryConfidence: null, commitSha: null }));
    expect(text).not.toContain('Feedback');
    expect(text).toContain('Prompt\n  (not recorded)');
    expect(text).toContain('Category  unclassified');
    expect(text).toContain('Commit    (none)  2026-11-05 09:30 UTC');
  });

  it(`shows at most ${MAX_DIFF_LINES} diff lines`, () => {
    const lines = (prefix: string) => Array.from({ length: 300 }, (_, i) => `${prefix}${i}`).join('\n');
    const text = formatDetail(failure({ aiContent: lines('a'), finalContent: lines('b') }));
    expect(text).toMatch(/… \d+ more lines/);
    expect(text.split('\n').filter((line) => /^ {2}[-+ @]/.test(line)).length).toBeLessThanOrEqual(MAX_DIFF_LINES + 4);
  });

  it('makes a line-ending-only change visible', () => {
    const text = formatDetail(failure({ aiContent: 'foo\r\n', finalContent: 'foo\n' }));
    expect(text).toContain('  -foo␍');
    expect(text).toContain('  +foo\n');
  });

  it(`cuts a diff line to ${MAX_DIFF_LINE_CHARS} characters`, () => {
    const text = formatDetail(failure({ finalContent: `${'x'.repeat(5000)}\n` }));
    const longest = Math.max(...text.split('\n').map((line) => line.length));
    expect(longest).toBeLessThanOrEqual(MAX_DIFF_LINE_CHARS + 10);
    expect(text).toContain('…');
  });

  it('cleans every field read from the database', () => {
    const text = formatDetail(failure({ commitSha: '\u001b[2Jabc', createdAt: '2026\u001b-11-05T09:30:00.000Z' }));
    expect(text).not.toContain('\u001b');
  });

  it('copes with a confidence that is not a number', () => {
    expect(formatDetail(failure({ categoryConfidence: 'high' as unknown as number }))).toContain('Category  logic: wrong boundary');
  });

  it('keeps tabs in code and drops escape sequences', () => {
    const text = formatDetail(failure({ finalContent: '\tconst x = "\u001b[31m";\n' }));
    expect(text).toContain('+\tconst x = "?[31m";');
    expect(text).not.toContain('\u001b');
  });
});

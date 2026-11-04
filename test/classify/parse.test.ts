import { describe, expect, it } from 'vitest';
import { parseClaudeOutput } from '../../src/classify/parse.js';

const answer = { category: 'logic', reason: 'off-by-one in the loop', confidence: 0.8 };

describe('parseClaudeOutput', () => {
  it('reads structured_output', () => {
    expect(parseClaudeOutput(JSON.stringify({ type: 'result', structured_output: answer, result: '' }))).toEqual({
      ok: true,
      value: answer,
    });
  });

  it('falls back to JSON text in result, with or without a code fence', () => {
    expect(parseClaudeOutput(JSON.stringify({ result: JSON.stringify(answer) }))).toEqual({ ok: true, value: answer });
    expect(parseClaudeOutput(JSON.stringify({ result: `\`\`\`json\n${JSON.stringify(answer)}\n\`\`\`` }))).toEqual({
      ok: true,
      value: answer,
    });
  });

  it('caps the reason at 300 characters', () => {
    const out = parseClaudeOutput(JSON.stringify({ structured_output: { ...answer, reason: 'x'.repeat(400) } }));
    expect(out.ok && out.value.reason.length).toBe(300);
  });

  it.each([
    ['broken JSON', '{nope'],
    ['a JSON array', '[]'],
    ['an error result', JSON.stringify({ is_error: true, structured_output: answer })],
    ['no answer', JSON.stringify({ result: 'I think it is a logic error.' })],
    ['an unknown category', JSON.stringify({ structured_output: { ...answer, category: 'typo' } })],
    ['an inherited property as category', JSON.stringify({ structured_output: { ...answer, category: 'toString' } })],
    ['a missing reason', JSON.stringify({ structured_output: { category: 'logic', confidence: 0.5 } })],
    ['an empty reason', JSON.stringify({ structured_output: { ...answer, reason: '  ' } })],
    ['confidence above 1', JSON.stringify({ structured_output: { ...answer, confidence: 1.5 } })],
    ['confidence below 0', JSON.stringify({ structured_output: { ...answer, confidence: -0.1 } })],
    ['confidence as text', JSON.stringify({ structured_output: { ...answer, confidence: '0.9' } })],
  ])('rejects %s', (_label, stdout) => {
    expect(parseClaudeOutput(stdout).ok).toBe(false);
  });
});

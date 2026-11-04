import { describe, expect, it } from 'vitest';
import { loadCases, MAX_EVAL_FILE_BYTES, parseCases } from '../../src/eval/cases.js';

const line = (overrides: Record<string, unknown> = {}, input: Record<string, unknown> = {}) =>
  JSON.stringify({
    schema: 'nightowl.eval/v1',
    id: 'c1',
    file_path: 'src/a.ts',
    input: { prompt: 'fix it', file_before: 'v0\n', ...input },
    rejected: 'v1\n',
    expected: 'v2\n',
    ...overrides,
  });

describe('parseCases', () => {
  it('reads valid cases in order', () => {
    const loaded = parseCases(`${line()}\n${line({ id: 'c2' }, { file_before: null })}\n`);
    expect(loaded.cases).toEqual([
      { id: 'c1', filePath: 'src/a.ts', prompt: 'fix it', fileBefore: 'v0\n', rejected: 'v1\n', expected: 'v2\n' },
      { id: 'c2', filePath: 'src/a.ts', prompt: 'fix it', fileBefore: null, rejected: 'v1\n', expected: 'v2\n' },
    ]);
    expect([loaded.invalid, loaded.noPrompt, loaded.tooLarge]).toEqual([0, 0, 0]);
  });

  it('counts broken lines, unknown schemas and missing fields as invalid', () => {
    const text = ['{nope', line({ schema: 'other/v1' }), line({ expected: 3 }), line({ input: 'x' }), line({}, { file_before: 5 }), ''].join('\n');
    expect(parseCases(text)).toMatchObject({ cases: [], invalid: 5 });
  });

  it('skips cases without a prompt and with a large file', () => {
    const big = 'x'.repeat(MAX_EVAL_FILE_BYTES + 1);
    const loaded = parseCases([line({}, { prompt: null }), line({}, { prompt: '  ' }), line({}, { file_before: big }), line()].join('\n'));
    expect(loaded).toMatchObject({ noPrompt: 2, tooLarge: 1, invalid: 0 });
    expect(loaded.cases).toHaveLength(1);
  });

  it('reports a missing file', async () => {
    await expect(loadCases('/nonexistent/evals.jsonl')).rejects.toMatchObject({ code: 'ENOENT' });
  });
});

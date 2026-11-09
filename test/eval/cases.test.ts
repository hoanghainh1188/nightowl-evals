import { describe, expect, it } from 'vitest';
import { truncate, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadCases, MAX_EVAL_FILE_BYTES, MAX_PROMPT_BYTES, MAX_SUITE_BYTES, parseCases, SuiteError } from '../../src/eval/cases.js';
import { buildEvalPrompt } from '../../src/eval/prompt.js';
import { createTempDir } from '../helpers/temp-repo.js';

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
    expect(Object.values(loaded.skipped).every((n) => n === 0)).toBe(true);
  });

  it('reads a case with feedback but never hands the feedback to the model', () => {
    const loaded = parseCases(`${line({ source: 'ai-self-fix' }, { feedback: 'wrong, 18 counts' })}\n`);
    expect(loaded.cases).toHaveLength(1);
    const prompt = buildEvalPrompt(loaded.cases[0] as (typeof loaded.cases)[number]);
    expect(prompt).toContain('fix it');
    expect(prompt).not.toContain('18 counts');
  });

  it('counts broken lines, unknown schemas and missing fields as invalid', () => {
    const text = ['{nope', line({ schema: 'other/v1' }), line({ expected: 3 }), line({ input: 'x' }), line({}, { file_before: 5 }), ''].join('\n');
    expect(parseCases(text)).toMatchObject({ cases: [], skipped: { invalid: 5 } });
  });

  it('skips cases without a prompt, too large, in sensitive files, without change, or with a repeated id', () => {
    const big = 'x'.repeat(MAX_EVAL_FILE_BYTES + 1);
    const loaded = parseCases(
      [
        line({}, { prompt: null }),
        line({}, { prompt: '  ' }),
        line({}, { file_before: big }),
        line({}, { prompt: 'p'.repeat(MAX_PROMPT_BYTES + 1) }),
        line({ file_path: '.env.local' }),
        line({ expected: '  v1  \n\n' }),
        line(),
        line(),
      ].join('\n'),
    );
    expect(loaded.skipped).toEqual({ invalid: 0, duplicate: 1, 'no-prompt': 2, 'too-large': 2, sensitive: 1, 'no-change': 1 });
    expect(loaded.cases).toHaveLength(1);
  });

  it('skips cases containing inline secrets', () => {
    const loaded = parseCases(
      [
        line({ rejected: 'const key = "ghp_123456789012345678901234567890123456";\n' }),
        line({ expected: 'const key = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890";\n' }),
        line({}, { file_before: 'const key = "AKIAIOSFODNN7EXAMPLE";\n' }),
      ].join('\n'),
    );
    expect(loaded.skipped.sensitive).toBe(3);
    expect(loaded.cases).toHaveLength(0);
  });

  it('reports a missing file and refuses anything but a regular file of at most 32 MB', async () => {
    await expect(loadCases('/nonexistent/evals.jsonl')).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(loadCases('/dev/null')).rejects.toBeInstanceOf(SuiteError);
    const dir = await createTempDir();
    try {
      const big = join(dir.path, 'big.jsonl');
      await writeFile(big, '');
      await truncate(big, MAX_SUITE_BYTES + 1);
      await expect(loadCases(big)).rejects.toThrow(/32 MB/);
      await expect(loadCases(dir.path)).rejects.toBeInstanceOf(SuiteError);
    } finally {
      await dir.cleanup();
    }
  });
});

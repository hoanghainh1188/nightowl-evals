import { describe, expect, it } from 'vitest';
import { evalId, toEvalCase } from '../../src/export/eval-case.js';
import type { FailureToExport } from '../../src/storage/failures.js';

const failure = (overrides: Partial<FailureToExport> = {}): FailureToExport => ({
  id: 7,
  createdAt: '2026-11-04T10:00:00.000Z',
  filePath: 'src/a.ts',
  commitSha: '3f2a9c1d8e07aa55',
  prompt: 'add email validation',
  aiContent: 'v1\n',
  finalContent: 'v2\n',
  category: 'logic',
  categoryReason: 'wrong condition',
  categoryConfidence: 0.8,
  source: 'manual-fix',
  feedback: null,
  ...overrides,
});

describe('toEvalCase', () => {
  it('has every field, in a fixed key order', () => {
    const line = JSON.stringify(toEvalCase(failure(), 'id-1', 'v0\n'));
    expect(JSON.parse(line)).toEqual({
      schema: 'nightowl.eval/v1',
      id: 'id-1',
      file_path: 'src/a.ts',
      commit_sha: '3f2a9c1d8e07aa55',
      source: 'manual-fix',
      created_at: '2026-11-04T10:00:00.000Z',
      input: { prompt: 'add email validation', file_before: 'v0\n', feedback: null },
      rejected: 'v1\n',
      expected: 'v2\n',
      category: 'logic',
      category_reason: 'wrong condition',
      category_confidence: 0.8,
      criteria: { type: 'reference', description: expect.stringContaining('`expected`') },
    });
    expect(Object.keys(JSON.parse(line))).toEqual([
      'schema',
      'id',
      'file_path',
      'commit_sha',
      'source',
      'created_at',
      'input',
      'rejected',
      'expected',
      'category',
      'category_reason',
      'category_confidence',
      'criteria',
    ]);
  });

  it('carries the feedback prompt of an AI self-fix', () => {
    const c = toEvalCase(failure({ source: 'ai-self-fix', feedback: 'wrong, 18 counts' }), 'x', null);
    expect(c.source).toBe('ai-self-fix');
    expect(Object.keys(c.input)).toEqual(['prompt', 'file_before', 'feedback']);
    expect(c.input.feedback).toBe('wrong, 18 counts');
  });

  it('keeps nulls for unclassified failures without prompt or previous file', () => {
    const c = toEvalCase(failure({ prompt: null, category: null, categoryReason: null, categoryConfidence: null }), 'x', null);
    expect(c).toMatchObject({ input: { prompt: null, file_before: null }, category: null, category_confidence: null });
  });
});

describe('evalId', () => {
  it('is built from the commit and the failure, so it never depends on what else is exported', () => {
    expect(evalId(failure({ id: 3 }))).toBe('3f2a9c1d8e07-3');
    expect(evalId(failure({ id: 4, commitSha: null }))).toBe('failure-4');
    expect(evalId(failure({ id: 3, filePath: 'other.ts' }))).toBe('3f2a9c1d8e07-3');
  });
});

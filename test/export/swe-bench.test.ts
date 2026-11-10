import { describe, expect, it } from 'vitest';
import { SWE_BENCH_SCHEMA } from '../../src/export/formats.js';
import { buildProblemStatement, toSweBenchInstance } from '../../src/export/swe-bench.js';
import type { FailureToExport } from '../../src/storage/failures.js';

const failure = (overrides: Partial<FailureToExport> = {}): FailureToExport => ({
  id: 7,
  createdAt: '2026-11-10T12:00:00.000Z',
  filePath: 'src/cli.ts',
  commitSha: 'abcdef1234567890',
  prompt: 'fix the bug',
  aiContent: 'wrong\n',
  finalContent: 'right\n',
  category: 'logic',
  categoryReason: null,
  categoryConfidence: null,
  source: 'manual-fix',
  feedback: 'try again',
  ...overrides,
});

describe('toSweBenchInstance', () => {
  it('maps core fields and leaves harness lists empty', () => {
    const row = toSweBenchInstance(failure(), 'before\n', 'owner/repo', 'parentsha');
    expect(row.schema).toBe(SWE_BENCH_SCHEMA);
    expect(row.instance_id).toBe('abcdef123456-7');
    expect(row.repo).toBe('owner/repo');
    expect(row.base_commit).toBe('parentsha');
    expect(row.problem_statement).toContain('src/cli.ts');
    expect(row.problem_statement).toContain('fix the bug');
    expect(row.patch).toContain('--- a/src/cli.ts');
    expect(row.patch).toContain('+right');
    expect(row.test_patch).toBe('');
    expect(row.FAIL_TO_PASS).toEqual([]);
    expect(row.PASS_TO_PASS).toEqual([]);
    expect(row.hints_text).toBe('try again');
  });

  it('allows null base_commit', () => {
    const row = toSweBenchInstance(failure({ commitSha: null }), null, 'local', null);
    expect(row.base_commit).toBeNull();
    expect(row.instance_id).toBe('failure-7');
  });
});

describe('buildProblemStatement', () => {
  it('includes category when present', () => {
    expect(buildProblemStatement(failure())).toContain('Category: logic');
  });
});

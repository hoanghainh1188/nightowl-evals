import { describe, expect, it } from 'vitest';
import { scanFailurePrivacy } from '../../src/privacy/export-case.js';
import type { FailureToExport } from '../../src/storage/failures.js';

function failure(partial: Partial<FailureToExport> & Pick<FailureToExport, 'filePath' | 'aiContent' | 'finalContent'>): FailureToExport {
  return {
    id: 1,
    createdAt: '2026-11-12T00:00:00.000Z',
    commitSha: null,
    prompt: null,
    category: null,
    categoryReason: null,
    categoryConfidence: null,
    source: 'manual-fix',
    feedback: null,
    ...partial,
  };
}

describe('scanFailurePrivacy', () => {
  it('counts skippedSensitive for inline-secret bodies instead of secrets', () => {
    const row = failure({
      filePath: 'src/a/b.ts',
      aiContent: 'leak sk-ant-abcdefghijklmnopqrstuvwxyz012345\n',
      finalContent: 'ok\n',
    });
    expect(scanFailurePrivacy(row, true)).toEqual({
      secrets: 0,
      emails: 0,
      paths: 0,
      skippedSensitive: 1,
    });
  });

  it('counts path coarsen hits only for exportable rows', () => {
    const row = failure({
      filePath: 'src/hooks/git/run.ts',
      aiContent: 'ai\n',
      finalContent: 'dev\n',
      prompt: 'ping user@example.com',
    });
    expect(scanFailurePrivacy(row, true)).toEqual({
      secrets: 0,
      emails: 1,
      paths: 1,
      skippedSensitive: 0,
    });
  });
});

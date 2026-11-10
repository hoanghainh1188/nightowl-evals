import { unifiedDiff } from '../classify/diff.js';

const EXPORT_MAX_EDITS = 50_000;

function wholeFileReplace(filePath: string, before: string, after: string): string {
  const beforeLines = before.length === 0 ? [] : before.replace(/\n$/, '').split('\n');
  const afterLines = after.length === 0 ? [] : after.replace(/\n$/, '').split('\n');
  const minus = beforeLines.map((line) => `-${line}`).join('\n');
  const plus = afterLines.map((line) => `+${line}`).join('\n');
  const body = [minus, plus].filter((part) => part.length > 0).join('\n');
  return [
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
    `@@ -1,${Math.max(beforeLines.length, 1)} +1,${Math.max(afterLines.length, 1)} @@`,
    body,
    '',
  ].join('\n');
}

/**
 * Build a single-file unified diff with git-style path headers for SWE-bench `patch`.
 * Prefers `fileBefore` when present; otherwise diffs `rejected` → `expected`.
 */
export function filePatch(filePath: string, fileBefore: string | null, rejected: string, expected: string): string {
  const before = fileBefore ?? rejected;
  const body = unifiedDiff(before, expected, { maxEdits: EXPORT_MAX_EDITS });
  if (body === null) return wholeFileReplace(filePath, before, expected);
  if (body === '') return '';
  const lines = body.split('\n');
  // unifiedDiff starts with "--- ai\n+++ dev\n"
  if (lines[0]?.startsWith('--- ') && lines[1]?.startsWith('+++ ')) {
    lines[0] = `--- a/${filePath}`;
    lines[1] = `+++ b/${filePath}`;
  }
  return `${lines.join('\n').replace(/\n$/, '')}\n`;
}

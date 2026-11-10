import { createHash } from 'node:crypto';

// Empty / missing parts use a control sentinel so they never collide with the literal string "unknown".
const EMPTY = '\u0000';

export function fingerprint(...parts: readonly (string | number | null | undefined)[]): string {
  const normalized = parts.map((p) => (p == null || p === '' ? EMPTY : String(p))).join('\u0001');
  return createHash('sha256').update(normalized).digest('hex');
}

export function ciDedupeKey(parts: {
  readonly commitSha?: string | null;
  readonly suite?: string | null;
  readonly classname?: string | null;
  readonly name?: string | null;
  readonly file?: string | null;
}): string | null {
  const values = [parts.commitSha, parts.suite, parts.classname, parts.name, parts.file];
  // Without any identifying field, skip dedupe so distinct empty rows are not collapsed.
  if (values.every((v) => v == null || v === '')) return null;
  return `ci:${fingerprint(parts.commitSha, parts.suite, parts.classname, parts.name, parts.file)}`;
}

export function prDedupeKey(parts: {
  readonly commentId?: string | number | null;
  readonly pr?: string | number | null;
  readonly path?: string | null;
  readonly line?: string | number | null;
  readonly bodyPrefix?: string | null;
}): string | null {
  if (parts.commentId != null && String(parts.commentId).length > 0) {
    return `pr:id:${parts.commentId}`;
  }
  const values = [parts.pr, parts.path, parts.line, parts.bodyPrefix];
  if (values.every((v) => v == null || v === '')) return null;
  return `pr:${fingerprint(parts.pr, parts.path, parts.line, parts.bodyPrefix)}`;
}

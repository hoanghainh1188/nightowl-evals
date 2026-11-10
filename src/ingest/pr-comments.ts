export interface PrReviewRecord {
  readonly commentId: string | null;
  readonly path: string | null;
  readonly line: number | null;
  readonly body: string;
  readonly commitId: string | null;
  readonly user: string | null;
  readonly pr: string | null;
}

export const BODY_LIMIT = 500;

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function asLine(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  return null;
}

function truncateBody(body: string): string {
  return body.length <= BODY_LIMIT ? body : `${body.slice(0, BODY_LIMIT)}…`;
}

function normalizeComment(item: unknown, defaultPr: string | null): PrReviewRecord | null {
  if (item === null || typeof item !== 'object') return null;
  const row = item as Record<string, unknown>;
  const body = asString(row.body) ?? asString(row.comment);
  if (body === null) return null;
  const userRaw = row.user;
  const user =
    asString(row.user) ??
    (userRaw !== null && typeof userRaw === 'object' ? asString((userRaw as { login?: unknown }).login) : null);
  return {
    commentId: asString(row.id) ?? asString(row.comment_id),
    path: asString(row.path) ?? asString(row.file) ?? asString(row.file_path),
    line: asLine(row.line) ?? asLine(row.original_line),
    body: truncateBody(body),
    commitId: asString(row.commit_id) ?? asString(row.commit),
    user,
    pr: asString(row.pr) ?? asString(row.pull_request) ?? defaultPr,
  };
}

/** Local PR review JSON: array of comments, or `{ "comments": [...] }`. */
export function parsePrCommentsJson(raw: string, defaultPr: string | null = null): readonly PrReviewRecord[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error('PR comments JSON is not valid JSON');
  }
  const list = Array.isArray(parsed)
    ? parsed
    : parsed !== null && typeof parsed === 'object' && Array.isArray((parsed as { comments?: unknown }).comments)
      ? (parsed as { comments: unknown[] }).comments
      : null;
  if (list === null) throw new Error('PR comments JSON must be an array or an object with a "comments" array');

  const out: PrReviewRecord[] = [];
  for (const item of list) {
    const record = normalizeComment(item, defaultPr);
    if (record !== null) out.push(record);
  }
  return Object.freeze(out);
}

export function githubCommentsToRecords(comments: readonly unknown[], pr: string | null): readonly PrReviewRecord[] {
  const out: PrReviewRecord[] = [];
  for (const item of comments) {
    const record = normalizeComment(item, pr);
    if (record !== null) out.push(record);
  }
  return Object.freeze(out);
}

import type { DatabaseSync } from 'node:sqlite';
import { rollbackQuietly } from './migrations.js';

export interface UnattachedCheck {
  readonly id: number;
  readonly filePath: string;
  // null for skipped checks, which have no staged blob.
  readonly stagedBlob: string | null;
}

export interface NewFailure {
  readonly filePath: string;
  readonly aiEventId: number;
  readonly promptEventId: number | null;
  readonly aiContent: string;
  readonly finalContent: string;
}

export type Attachment =
  | { readonly checkId: number; readonly outcome: 'failure'; readonly failure: NewFailure }
  | { readonly checkId: number; readonly outcome: 'not-a-failure' | 'superseded' };

export interface FailureCounts {
  readonly total: number;
  readonly byStatus: Readonly<Record<string, number>>;
}

// Commit-checks post-commit has not handled yet, oldest first. Payloads are read one by one later.
export function listUnattachedChecks(db: DatabaseSync): readonly UnattachedCheck[] {
  const rows = db
    .prepare(
      `SELECT e.id, e.file_path, json_extract(e.payload, '$.staged_blob') AS staged_blob FROM events e
       WHERE e.source = 'git' AND e.kind = 'commit-check' AND e.file_path IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM checks_attached a WHERE a.check_id = e.id)
       ORDER BY e.id`,
    )
    .all() as unknown as Array<{ id: number; file_path: string; staged_blob: unknown }>;
  return Object.freeze(
    rows.map((row) =>
      Object.freeze({
        id: row.id,
        filePath: row.file_path,
        stagedBlob: typeof row.staged_blob === 'string' ? row.staged_blob : null,
      }),
    ),
  );
}

export function getEventPayload(db: DatabaseSync, id: number): unknown {
  const row = db.prepare('SELECT payload FROM events WHERE id = ?').get(id) as { payload: string } | undefined;
  return row === undefined ? null : (JSON.parse(row.payload) as unknown);
}

// The latest prompt of the edit's Claude Code session sent before that edit.
export function findPromptBefore(db: DatabaseSync, editId: number): number | null {
  const row = db
    .prepare(
      `SELECT p.id FROM events p JOIN events e ON e.id = ?
       WHERE p.source = 'claude-code' AND p.kind = 'prompt'
         AND p.session_id = e.session_id AND p.id < e.id
       ORDER BY p.id DESC LIMIT 1`,
    )
    .get(editId) as { id: number } | undefined;
  return row?.id ?? null;
}

// Stores the outcome of each check, and the failures they produce, in one transaction.
// Checks another process attached meanwhile are skipped. Returns the number of failures created.
export function attachChecks(db: DatabaseSync, commitSha: string, attachments: readonly Attachment[]): number {
  db.exec('BEGIN IMMEDIATE');
  try {
    const attached = db.prepare('SELECT 1 FROM checks_attached WHERE check_id = ?');
    const insertFailure = db.prepare(
      `INSERT INTO failures (created_at, file_path, ai_event_id, prompt_event_id, ai_content, final_content, commit_sha)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    );
    const attach = db.prepare('INSERT INTO checks_attached (check_id, outcome, commit_sha, failure_id) VALUES (?, ?, ?, ?)');
    let created = 0;
    for (const item of attachments) {
      if (attached.get(item.checkId) !== undefined) continue;
      let failureId: number | null = null;
      if (item.outcome === 'failure') {
        const f = item.failure;
        const row = insertFailure.get(
          new Date().toISOString(),
          f.filePath,
          f.aiEventId,
          f.promptEventId,
          f.aiContent,
          f.finalContent,
          commitSha,
        ) as { id: number };
        failureId = row.id;
        created += 1;
      }
      attach.run(item.checkId, item.outcome, commitSha, failureId);
    }
    db.exec('COMMIT');
    return created;
  } catch (error) {
    rollbackQuietly(db);
    throw error;
  }
}

export function countFailures(db: DatabaseSync): FailureCounts {
  const rows = db.prepare('SELECT status, COUNT(*) AS n FROM failures GROUP BY status ORDER BY status').all() as unknown as Array<{
    status: string;
    n: number;
  }>;
  return Object.freeze({
    total: rows.reduce((sum, row) => sum + row.n, 0),
    byStatus: Object.freeze(Object.fromEntries(rows.map((row) => [row.status, row.n]))),
  });
}

export interface FailureToClassify {
  readonly id: number;
  readonly filePath: string;
  readonly userPrompt: string | null;
  readonly aiContent: string;
  readonly finalContent: string;
}

export interface SavedClassification {
  readonly category: string;
  readonly reason: string;
  readonly confidence: number;
  readonly classifier: string;
  readonly classifiedAt: string;
}

// Fewest failed attempts first, then oldest, so failures that keep failing do not block the rest.
// With `redo`, failures that already have a category are included too.
export function listFailuresToClassify(db: DatabaseSync, limit: number, redo: boolean): readonly FailureToClassify[] {
  const rows = db
    .prepare(
      `SELECT f.id, f.file_path, f.ai_content, f.final_content, json_extract(p.payload, '$.prompt') AS prompt
       FROM failures f LEFT JOIN events p ON p.id = f.prompt_event_id
       WHERE ? OR f.category IS NULL
       ORDER BY f.classify_attempts, f.id LIMIT ?`,
    )
    .all(redo ? 1 : 0, limit) as unknown as Array<{
    id: number;
    file_path: string;
    ai_content: string;
    final_content: string;
    prompt: unknown;
  }>;
  return Object.freeze(
    rows.map((row) =>
      Object.freeze({
        id: row.id,
        filePath: row.file_path,
        userPrompt: typeof row.prompt === 'string' ? row.prompt : null,
        aiContent: row.ai_content,
        finalContent: row.final_content,
      }),
    ),
  );
}

export function saveClassification(db: DatabaseSync, failureId: number, value: SavedClassification): void {
  db.prepare(
    `UPDATE failures SET category = ?, category_reason = ?, category_confidence = ?, classifier = ?, classified_at = ?,
       classify_error = NULL
     WHERE id = ?`,
  ).run(value.category, value.reason, value.confidence, value.classifier, value.classifiedAt, failureId);
}

export function recordClassifyError(db: DatabaseSync, failureId: number, error: string): void {
  db.prepare('UPDATE failures SET classify_attempts = classify_attempts + 1, classify_error = ? WHERE id = ?').run(
    error.slice(0, 200),
    failureId,
  );
}

export interface ExportFilter {
  readonly since: string | null;
  // null = every category; 'unclassified' selects failures without one.
  readonly categories: readonly string[] | null;
}

export interface FailureToExport {
  readonly id: number;
  readonly createdAt: string;
  readonly filePath: string;
  readonly commitSha: string | null;
  readonly prompt: string | null;
  readonly aiContent: string;
  readonly finalContent: string;
  readonly category: string | null;
  readonly categoryReason: string | null;
  readonly categoryConfidence: number | null;
}

// Failures not dismissed, oldest first, with their prompt text.
export function listFailuresToExport(db: DatabaseSync, filter: ExportFilter): readonly FailureToExport[] {
  const categories = filter.categories === null ? null : JSON.stringify(filter.categories);
  const rows = db
    .prepare(
      `SELECT f.id, f.created_at, f.file_path, f.commit_sha, json_extract(p.payload, '$.prompt') AS prompt,
              f.ai_content, f.final_content, f.category, f.category_reason, f.category_confidence
       FROM failures f LEFT JOIN events p ON p.id = f.prompt_event_id
       WHERE f.status != 'dismissed'
         AND (?1 IS NULL OR f.created_at >= ?1)
         AND (?2 IS NULL OR COALESCE(f.category, 'unclassified') IN (SELECT value FROM json_each(?2)))
       ORDER BY f.id`,
    )
    .all(filter.since, categories) as unknown as Array<{
    id: number;
    created_at: string;
    file_path: string;
    commit_sha: string | null;
    prompt: unknown;
    ai_content: string;
    final_content: string;
    category: string | null;
    category_reason: string | null;
    category_confidence: number | null;
  }>;
  return Object.freeze(
    rows.map((row) =>
      Object.freeze({
        id: row.id,
        createdAt: row.created_at,
        filePath: row.file_path,
        commitSha: row.commit_sha,
        prompt: typeof row.prompt === 'string' ? row.prompt : null,
        aiContent: row.ai_content,
        finalContent: row.final_content,
        category: row.category,
        categoryReason: row.category_reason,
        categoryConfidence: row.category_confidence,
      }),
    ),
  );
}

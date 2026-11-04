import type { DatabaseSync } from 'node:sqlite';
import { rollbackQuietly } from './migrations.js';

export interface UnattachedCheck {
  readonly id: number;
  readonly filePath: string;
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
      `SELECT e.id, e.file_path FROM events e
       WHERE e.source = 'git' AND e.kind = 'commit-check' AND e.file_path IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM checks_attached a WHERE a.check_id = e.id)
       ORDER BY e.id`,
    )
    .all() as unknown as Array<{ id: number; file_path: string }>;
  return Object.freeze(rows.map((row) => Object.freeze({ id: row.id, filePath: row.file_path })));
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

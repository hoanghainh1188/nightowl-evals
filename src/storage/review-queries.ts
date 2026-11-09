import type { DatabaseSync } from 'node:sqlite';
import type { FailureSource } from './failures.js';
import { rollbackQuietly } from './migrations.js';

export type FailureStatus = 'flagged' | 'confirmed' | 'dismissed';

export interface ReviewFilter {
  // null for every status.
  readonly statuses: readonly FailureStatus[] | null;
  readonly source: FailureSource | null;
  readonly agents: readonly string[] | null;
  readonly limit: number;
}

export interface FailureForReview {
  readonly id: number;
  readonly createdAt: string;
  readonly filePath: string;
  readonly commitSha: string | null;
  readonly source: FailureSource;
  readonly agent: string | null;
  readonly status: FailureStatus;
  readonly category: string | null;
  readonly categoryReason: string | null;
  readonly categoryConfidence: number | null;
  readonly prompt: string | null;
  readonly feedback: string | null;
  readonly aiContent: string;
  readonly finalContent: string;
}

export type StatusChange =
  | { readonly ok: true; readonly changed: readonly number[]; readonly unchanged: readonly number[] }
  | { readonly ok: false; readonly missing: readonly number[] };

const SELECT = `SELECT f.id, f.created_at, f.file_path, f.commit_sha, f.source, f.agent, f.status, f.category, f.category_reason,
         f.category_confidence, json_extract(p.payload, '$.prompt') AS prompt, json_extract(b.payload, '$.prompt') AS feedback,
         f.ai_content, f.final_content
       FROM failures f
         LEFT JOIN events p ON p.id = f.prompt_event_id
         LEFT JOIN events b ON b.id = f.feedback_event_id`;

interface Row {
  id: number;
  created_at: string;
  file_path: string;
  commit_sha: string | null;
  source: FailureSource;
  agent: string | null;
  status: FailureStatus;
  category: string | null;
  category_reason: string | null;
  category_confidence: number | null;
  prompt: unknown;
  feedback: unknown;
  ai_content: string;
  final_content: string;
}

const text = (value: unknown): string | null => (typeof value === 'string' ? value : null);

function toFailure(row: Row): FailureForReview {
  return Object.freeze({
    id: row.id,
    createdAt: row.created_at,
    filePath: row.file_path,
    commitSha: row.commit_sha,
    source: row.source,
    agent: row.agent,
    status: row.status,
    category: row.category,
    categoryReason: row.category_reason,
    categoryConfidence: row.category_confidence,
    prompt: text(row.prompt),
    feedback: text(row.feedback),
    aiContent: row.ai_content,
    finalContent: row.final_content,
  });
}

// Newest first. Plain `?` placeholders: numbered ones fail to bind on Node 22.13's node:sqlite.
export function listFailuresForReview(db: DatabaseSync, filter: ReviewFilter): readonly FailureForReview[] {
  const statuses = filter.statuses === null ? null : JSON.stringify(filter.statuses);
  const agents = filter.agents === null || filter.agents.length === 0 ? null : JSON.stringify(filter.agents);
  const rows = db
    .prepare(
      `${SELECT}
       WHERE (? IS NULL OR f.status IN (SELECT value FROM json_each(?)))
         AND (? IS NULL OR f.source = ?)
         AND (? IS NULL OR f.agent IN (SELECT value FROM json_each(?)))
       ORDER BY f.id DESC LIMIT ?`,
    )
    .all(statuses, statuses, filter.source, filter.source, agents, agents, filter.limit) as unknown as Row[];
  return Object.freeze(rows.map(toFailure));
}

export function getFailureForReview(db: DatabaseSync, id: number): FailureForReview | null {
  const row = db.prepare(`${SELECT} WHERE f.id = ?`).get(id) as unknown as Row | undefined;
  return row === undefined ? null : toFailure(row);
}

// All or nothing: one unknown id leaves every failure as it was.
export function setFailureStatus(db: DatabaseSync, ids: readonly number[], status: FailureStatus): StatusChange {
  const unique = [...new Set(ids)].sort((a, b) => a - b);
  db.exec('BEGIN IMMEDIATE');
  try {
    const found = db
      .prepare('SELECT id, status FROM failures WHERE id IN (SELECT value FROM json_each(?))')
      .all(JSON.stringify(unique)) as unknown as Array<{ id: number; status: string }>;
    const known = new Map(found.map((row) => [row.id, row.status]));
    const missing = unique.filter((id) => !known.has(id));
    if (missing.length > 0) {
      db.exec('ROLLBACK');
      return { ok: false, missing };
    }
    const changed = unique.filter((id) => known.get(id) !== status);
    db.prepare('UPDATE failures SET status = ? WHERE id IN (SELECT value FROM json_each(?))').run(status, JSON.stringify(changed));
    db.exec('COMMIT');
    return { ok: true, changed, unchanged: unique.filter((id) => known.get(id) === status) };
  } catch (error) {
    rollbackQuietly(db);
    throw error;
  }
}

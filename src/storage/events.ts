import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import type { AnyAgentId } from '../agents/ids.js';
import { rollbackQuietly } from './migrations.js';

export type EventSource = 'agent-hook' | 'git';

export interface NewEvent {
  readonly source: EventSource;
  readonly kind: string;
  readonly sessionId?: string | null;
  readonly filePath?: string | null;
  readonly payload: unknown;
  readonly createdAt?: string;
  readonly agent?: AnyAgentId | null;
}

export interface StoredEvent {
  readonly id: number;
  readonly createdAt: string;
  readonly source: EventSource;
  readonly kind: string;
  readonly sessionId: string | null;
  readonly filePath: string | null;
  readonly payload: unknown;
  readonly agent: AnyAgentId | null;
}

export interface EventFilter {
  readonly filePath?: string;
  readonly since?: string;
  readonly kinds?: readonly string[];
  readonly agent?: AnyAgentId;
}

interface EventRow {
  id: number;
  created_at: string;
  source: EventSource;
  kind: string;
  session_id: string | null;
  file_path: string | null;
  payload: string;
  agent: AnyAgentId | null;
}

function toStoredEvent(row: EventRow): StoredEvent {
  return Object.freeze({
    id: row.id,
    createdAt: row.created_at,
    source: row.source,
    kind: row.kind,
    sessionId: row.session_id,
    filePath: row.file_path,
    payload: JSON.parse(row.payload) as unknown,
    agent: row.agent,
  });
}

export function insertEvent(db: DatabaseSync, event: NewEvent): StoredEvent {
  const row = db
    .prepare(
      `INSERT INTO events (created_at, source, kind, session_id, file_path, payload, agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
    )
    .get(
      event.createdAt ?? new Date().toISOString(),
      event.source,
      event.kind,
      event.sessionId ?? null,
      event.filePath ?? null,
      JSON.stringify(event.payload),
      event.agent ?? null,
    ) as unknown as EventRow;
  return toStoredEvent(row);
}

export function listEvents(db: DatabaseSync, filter: EventFilter = {}): readonly StoredEvent[] {
  if (filter.kinds?.length === 0) return [];
  const clauses: string[] = [];
  const params: SQLInputValue[] = [];
  if (filter.filePath !== undefined) {
    clauses.push('file_path = ?');
    params.push(filter.filePath);
  }
  if (filter.since !== undefined) {
    clauses.push('created_at >= ?');
    params.push(filter.since);
  }
  if (filter.kinds !== undefined) {
    clauses.push(`kind IN (${filter.kinds.map(() => '?').join(', ')})`);
    params.push(...filter.kinds);
  }
  if (filter.agent !== undefined) {
    clauses.push('agent = ?');
    params.push(filter.agent);
  }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT * FROM events ${where} ORDER BY id`).all(...params) as unknown as EventRow[];
  return Object.freeze(rows.map(toStoredEvent));
}

export interface PendingEdit {
  readonly id: number;
  readonly filePath: string;
  readonly sessionId: string | null;
  readonly agent: AnyAgentId | null;
}

// AI edits of one file that no commit has closed: not counted by any commit-check yet, or counted
// by a check post-commit has not handled (a commit attempt that did not go through). Oldest first.
export function listOpenEdits(db: DatabaseSync, filePath: string, agent?: AnyAgentId | null): readonly PendingEdit[] {
  const rows = db
    .prepare(
      `SELECT e.id, e.file_path, e.session_id, e.agent FROM events e
       WHERE e.file_path = ? AND e.source = 'agent-hook' AND e.kind = 'edit'
         AND (? IS NULL OR e.agent = ?)
         AND NOT EXISTS (
           SELECT 1 FROM checked_edits k JOIN checks_attached a ON a.check_id = k.check_id WHERE k.edit_id = e.id
         )
       ORDER BY e.id`,
    )
    .all(filePath, agent ?? null, agent ?? null) as unknown as Array<{
    id: number;
    file_path: string;
    session_id: string | null;
    agent: AnyAgentId | null;
  }>;
  return Object.freeze(
    rows.map((row) =>
      Object.freeze({ id: row.id, filePath: row.file_path, sessionId: row.session_id, agent: row.agent }),
    ),
  );
}

// AI edits of the given files that no commit-check has counted yet, oldest first.
// Reads only indexed columns: payloads (with snapshots) are fetched one by one later.
export function listUncheckedEdits(db: DatabaseSync, filePaths: readonly string[]): readonly PendingEdit[] {
  if (filePaths.length === 0) return [];
  const rows = db
    .prepare(
      `SELECT e.id, e.file_path, e.session_id, e.agent FROM events e
       WHERE e.file_path IN (SELECT value FROM json_each(?))
         AND e.source = 'agent-hook'
         AND e.kind = 'edit'
         AND NOT EXISTS (SELECT 1 FROM checked_edits k WHERE k.edit_id = e.id)
       ORDER BY e.id`,
    )
    .all(JSON.stringify(filePaths)) as unknown as Array<{
    id: number;
    file_path: string;
    session_id: string | null;
    agent: AnyAgentId | null;
  }>;
  return Object.freeze(
    rows.map((row) =>
      Object.freeze({ id: row.id, filePath: row.file_path, sessionId: row.session_id, agent: row.agent }),
    ),
  );
}

export function getSnapshot(db: DatabaseSync, editId: number): string | null {
  const row = db.prepare(`SELECT json_extract(payload, '$.snapshot') AS snapshot FROM events WHERE id = ?`).get(editId) as
    | { snapshot: unknown }
    | undefined;
  return typeof row?.snapshot === 'string' ? row.snapshot : null;
}

export function getEventAgent(db: DatabaseSync, editId: number): AnyAgentId | null {
  const row = db.prepare('SELECT agent FROM events WHERE id = ?').get(editId) as { agent: AnyAgentId | null } | undefined;
  return row?.agent ?? null;
}

// Stores a commit-check and marks the edits it counted, in one transaction.
export function recordCommitCheck(db: DatabaseSync, event: NewEvent, editIds: readonly number[]): StoredEvent {
  db.exec('BEGIN IMMEDIATE');
  try {
    const saved = insertEvent(db, event);
    const mark = db.prepare('INSERT INTO checked_edits (edit_id, check_id) VALUES (?, ?)');
    for (const id of editIds) mark.run(id, saved.id);
    db.exec('COMMIT');
    return saved;
  } catch (error) {
    rollbackQuietly(db);
    throw error;
  }
}

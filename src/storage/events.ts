import type { DatabaseSync, SQLInputValue } from 'node:sqlite';

export type EventSource = 'claude-code' | 'git';

export interface NewEvent {
  readonly source: EventSource;
  readonly kind: string;
  readonly sessionId?: string | null;
  readonly filePath?: string | null;
  readonly payload: unknown;
  readonly createdAt?: string;
}

export interface StoredEvent {
  readonly id: number;
  readonly createdAt: string;
  readonly source: EventSource;
  readonly kind: string;
  readonly sessionId: string | null;
  readonly filePath: string | null;
  readonly payload: unknown;
}

export interface EventFilter {
  readonly filePath?: string;
  readonly since?: string;
  readonly kinds?: readonly string[];
}

interface EventRow {
  id: number;
  created_at: string;
  source: EventSource;
  kind: string;
  session_id: string | null;
  file_path: string | null;
  payload: string;
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
  });
}

export function insertEvent(db: DatabaseSync, event: NewEvent): StoredEvent {
  const row = db
    .prepare(
      `INSERT INTO events (created_at, source, kind, session_id, file_path, payload)
       VALUES (?, ?, ?, ?, ?, ?)
       RETURNING *`,
    )
    .get(
      event.createdAt ?? new Date().toISOString(),
      event.source,
      event.kind,
      event.sessionId ?? null,
      event.filePath ?? null,
      JSON.stringify(event.payload),
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
  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT * FROM events ${where} ORDER BY id`).all(...params) as unknown as EventRow[];
  return Object.freeze(rows.map(toStoredEvent));
}

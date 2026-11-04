import type { DatabaseSync } from 'node:sqlite';

// Entry i moves the schema from version i to i + 1. Never edit a released entry; append a new one.
export const migrations: readonly string[] = Object.freeze([
  `
  CREATE TABLE events (
    id          INTEGER PRIMARY KEY,
    created_at  TEXT    NOT NULL,
    source      TEXT    NOT NULL CHECK (source IN ('claude-code', 'git')),
    kind        TEXT    NOT NULL,
    session_id  TEXT,
    file_path   TEXT,
    payload     TEXT    NOT NULL CHECK (json_valid(payload))
  );
  CREATE INDEX events_file_time ON events (file_path, created_at);
  CREATE INDEX events_session   ON events (session_id, created_at);

  CREATE TABLE failures (
    id             INTEGER PRIMARY KEY,
    created_at     TEXT NOT NULL,
    file_path      TEXT NOT NULL,
    ai_event_id    INTEGER REFERENCES events (id),
    ai_content     TEXT NOT NULL,
    final_content  TEXT NOT NULL,
    commit_sha     TEXT,
    category       TEXT CHECK (category IN ('logic', 'convention', 'misread-requirement', 'missing-context')),
    status         TEXT NOT NULL DEFAULT 'flagged' CHECK (status IN ('flagged', 'confirmed', 'dismissed'))
  );

  -- Which commit-check counted each AI edit; keeps the pre-commit lookup indexed.
  CREATE TABLE checked_edits (
    edit_id   INTEGER PRIMARY KEY REFERENCES events (id),
    check_id  INTEGER NOT NULL REFERENCES events (id)
  );
  `,
  `
  ALTER TABLE failures ADD COLUMN prompt_event_id INTEGER REFERENCES events (id);

  -- Each commit-check is handled by post-commit at most once.
  CREATE TABLE checks_attached (
    check_id    INTEGER PRIMARY KEY REFERENCES events (id),
    outcome     TEXT NOT NULL CHECK (outcome IN ('failure', 'not-a-failure', 'superseded')),
    commit_sha  TEXT,
    failure_id  INTEGER REFERENCES failures (id)
  );
  `,
]);

export const CURRENT_SCHEMA_VERSION = migrations.length;

export class SchemaTooNewError extends Error {
  constructor(readonly found: number) {
    super(
      `NightOwl database schema v${found} is newer than this NightOwl supports (v${CURRENT_SCHEMA_VERSION}). Upgrade NightOwl.`,
    );
    this.name = 'SchemaTooNewError';
  }
}

function userVersion(db: DatabaseSync): number {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number } | undefined;
  return row?.user_version ?? 0;
}

export function migrate(db: DatabaseSync): void {
  if (userVersion(db) > CURRENT_SCHEMA_VERSION) throw new SchemaTooNewError(userVersion(db));
  if (userVersion(db) === CURRENT_SCHEMA_VERSION) return;

  db.exec('BEGIN IMMEDIATE');
  try {
    // Re-read inside the write lock: another process may have migrated meanwhile.
    const from = userVersion(db);
    if (from > CURRENT_SCHEMA_VERSION) throw new SchemaTooNewError(from);
    for (const sql of migrations.slice(from)) db.exec(sql);
    db.exec(`PRAGMA user_version = ${CURRENT_SCHEMA_VERSION}`);
    db.exec('COMMIT');
  } catch (error) {
    rollbackQuietly(db);
    throw error;
  }
}

// Keeps the original error visible if ROLLBACK itself fails.
export function rollbackQuietly(db: DatabaseSync): void {
  try {
    db.exec('ROLLBACK');
  } catch {
    // The transaction is already gone; nothing left to undo.
  }
}

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
  `
  ALTER TABLE failures ADD COLUMN category_reason     TEXT;
  ALTER TABLE failures ADD COLUMN category_confidence REAL CHECK (category_confidence BETWEEN 0 AND 1);
  ALTER TABLE failures ADD COLUMN classified_at       TEXT;
  ALTER TABLE failures ADD COLUMN classifier          TEXT;
  ALTER TABLE failures ADD COLUMN classify_attempts   INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE failures ADD COLUMN classify_error      TEXT;
  `,
  `
  -- Where a failure was seen: the developer edited the AI code, or asked the AI to redo it.
  ALTER TABLE failures ADD COLUMN source TEXT NOT NULL DEFAULT 'manual-fix'
    CHECK (source IN ('manual-fix', 'ai-self-fix'));
  ALTER TABLE failures ADD COLUMN feedback_event_id INTEGER REFERENCES events (id);
  `,
  `
  -- Multi-agent: channel (agent-hook|git) + which assistant wrote the edit.
  CREATE TABLE events_v5 (
    id          INTEGER PRIMARY KEY,
    created_at  TEXT    NOT NULL,
    source      TEXT    NOT NULL CHECK (source IN ('agent-hook', 'git')),
    kind        TEXT    NOT NULL,
    session_id  TEXT,
    file_path   TEXT,
    payload     TEXT    NOT NULL CHECK (json_valid(payload)),
    agent       TEXT    CHECK (
      agent IS NULL OR agent IN (
        'claude-code', 'cursor', 'windsurf', 'cline', 'roo', 'copilot-workspace', 'aider', 'unknown'
      )
    )
  );
  INSERT INTO events_v5 (id, created_at, source, kind, session_id, file_path, payload, agent)
  SELECT id, created_at,
         CASE WHEN source = 'claude-code' THEN 'agent-hook' ELSE source END,
         kind, session_id, file_path, payload,
         CASE WHEN source = 'claude-code' THEN 'claude-code' ELSE NULL END
  FROM events;
  DROP TABLE events;
  ALTER TABLE events_v5 RENAME TO events;
  CREATE INDEX events_file_time ON events (file_path, created_at);
  CREATE INDEX events_session   ON events (session_id, created_at);
  CREATE INDEX events_agent     ON events (agent, created_at);

  ALTER TABLE failures ADD COLUMN agent TEXT CHECK (
    agent IS NULL OR agent IN (
      'claude-code', 'cursor', 'windsurf', 'cline', 'roo', 'copilot-workspace', 'aider', 'unknown'
    )
  );
  UPDATE failures SET agent = (
    SELECT e.agent FROM events e WHERE e.id = failures.ai_event_id
  ) WHERE ai_event_id IS NOT NULL;
  `,
  `
  -- CI / PR signal events (no invented failures.ai_content).
  CREATE TABLE events_v6 (
    id          INTEGER PRIMARY KEY,
    created_at  TEXT    NOT NULL,
    source      TEXT    NOT NULL CHECK (source IN ('agent-hook', 'git', 'ci', 'pr')),
    kind        TEXT    NOT NULL,
    session_id  TEXT,
    file_path   TEXT,
    payload     TEXT    NOT NULL CHECK (json_valid(payload)),
    agent       TEXT    CHECK (
      agent IS NULL OR agent IN (
        'claude-code', 'cursor', 'windsurf', 'cline', 'roo', 'copilot-workspace', 'aider', 'unknown'
      )
    ),
    dedupe_key  TEXT
  );
  INSERT INTO events_v6 (id, created_at, source, kind, session_id, file_path, payload, agent, dedupe_key)
  SELECT id, created_at, source, kind, session_id, file_path, payload, agent, NULL FROM events;
  DROP TABLE events;
  ALTER TABLE events_v6 RENAME TO events;
  CREATE INDEX events_file_time ON events (file_path, created_at);
  CREATE INDEX events_session   ON events (session_id, created_at);
  CREATE INDEX events_agent     ON events (agent, created_at);
  CREATE INDEX events_kind_time ON events (kind, created_at);
  CREATE UNIQUE INDEX events_dedupe ON events (dedupe_key) WHERE dedupe_key IS NOT NULL;
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

  // Table rebuilds (v5) need FKs off; cannot change this pragma inside a transaction.
  db.exec('PRAGMA foreign_keys = OFF');
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
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
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

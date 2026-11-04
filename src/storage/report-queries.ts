import type { DatabaseSync } from 'node:sqlite';

export interface FailureCountRow {
  readonly filePath: string;
  readonly category: string | null;
  readonly status: string;
  readonly source: string;
  // YYYY-MM-DD in UTC.
  readonly day: string;
  readonly count: number;
}

export interface CheckCountRow {
  readonly day: string;
  readonly outcome: 'failure' | 'not-a-failure';
  readonly count: number;
}

// Failure counts grouped by file, category, status, source and day. Never reads code columns.
export function countFailuresForReport(db: DatabaseSync, since: string | null): readonly FailureCountRow[] {
  const rows = db
    .prepare(
      `SELECT file_path, category, status, source, substr(created_at, 1, 10) AS day, COUNT(*) AS n
       FROM failures WHERE ? IS NULL OR created_at >= ?
       GROUP BY file_path, category, status, source, day ORDER BY day, file_path, source`,
    )
    
    // Plain `?` placeholders: numbered ones (?1) fail to bind on Node 22.13's node:sqlite.
    .all(since, since) as unknown as Array<{
      file_path: string;
      category: string | null;
      status: string;
      source: string;
      day: string;
      n: number;
    }>;
  return Object.freeze(
    rows.map((row) =>
      Object.freeze({
        filePath: row.file_path,
        category: row.category,
        status: row.status,
        source: row.source,
        day: row.day,
        count: row.n,
      }),
    ),
  );
}

// Commit-checks judged after a commit, by day of the check. Superseded checks never reached a commit.
export function countChecksForReport(db: DatabaseSync, since: string | null): readonly CheckCountRow[] {
  const rows = db
    .prepare(
      `SELECT substr(e.created_at, 1, 10) AS day, a.outcome, COUNT(*) AS n
       FROM checks_attached a JOIN events e ON e.id = a.check_id
       WHERE a.outcome != 'superseded' AND (? IS NULL OR e.created_at >= ?)
       GROUP BY day, a.outcome ORDER BY day`,
    )
    
    .all(since, since) as unknown as Array<{ day: string; outcome: 'failure' | 'not-a-failure'; n: number }>;
  return Object.freeze(rows.map((row) => Object.freeze({ day: row.day, outcome: row.outcome, count: row.n })));
}

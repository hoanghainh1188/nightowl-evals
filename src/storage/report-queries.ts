import type { DatabaseSync } from 'node:sqlite';

export interface FailureCountRow {
  readonly filePath: string;
  readonly category: string | null;
  readonly status: string;
  readonly source: string;
  readonly agent: string | null;
  // YYYY-MM-DD in UTC.
  readonly day: string;
  readonly count: number;
}

export interface CheckCountRow {
  readonly day: string;
  readonly outcome: 'failure' | 'not-a-failure';
  readonly agent: string | null;
  /** Path of the checked file when known (check event or linked edit); null if unscoped. */
  readonly filePath: string | null;
  readonly count: number;
}

export interface ReportQueryFilter {
  readonly since: string | null;
  readonly agents: readonly string[] | null;
  /** Exclusive upper bound on created_at (for baseline windows). */
  readonly until?: string | null;
}

function agentsJson(agents: readonly string[] | null): string | null {
  return agents === null || agents.length === 0 ? null : JSON.stringify(agents);
}

// Failure counts grouped by file, category, status, source, agent and day. Never reads code columns.
export function countFailuresForReport(db: DatabaseSync, filter: ReportQueryFilter): readonly FailureCountRow[] {
  const agents = agentsJson(filter.agents);
  const rows = db
    .prepare(
      `SELECT file_path, category, status, source, agent, substr(created_at, 1, 10) AS day, COUNT(*) AS n
       FROM failures
       WHERE (? IS NULL OR created_at >= ?)
         AND (? IS NULL OR agent IN (SELECT value FROM json_each(?)))
       GROUP BY file_path, category, status, source, agent, day ORDER BY day, file_path, source, agent`,
    )
    .all(filter.since, filter.since, agents, agents) as unknown as Array<{
    file_path: string;
    category: string | null;
    status: string;
    source: string;
    agent: string | null;
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
        agent: row.agent,
        day: row.day,
        count: row.n,
      }),
    ),
  );
}

// Commit-checks judged after a commit, by day of the check. Superseded checks never reached a commit.
// file_path prefers the check event path, else the earliest linked edit path (for workspace scoping).
export function countChecksForReport(db: DatabaseSync, filter: ReportQueryFilter): readonly CheckCountRow[] {
  const agents = agentsJson(filter.agents);
  const pathExpr = `COALESCE(
         NULLIF(e.file_path, ''),
         (SELECT ed.file_path FROM checked_edits k JOIN events ed ON ed.id = k.edit_id
          WHERE k.check_id = a.check_id AND ed.file_path IS NOT NULL AND ed.file_path != ''
          ORDER BY ed.id LIMIT 1)
       )`;
  const rows = db
    .prepare(
      `SELECT substr(e.created_at, 1, 10) AS day, a.outcome, e.agent, ${pathExpr} AS file_path, COUNT(*) AS n
       FROM checks_attached a JOIN events e ON e.id = a.check_id
       WHERE a.outcome != 'superseded'
         AND (? IS NULL OR e.created_at >= ?)
         AND (? IS NULL OR e.agent IN (SELECT value FROM json_each(?)))
       GROUP BY day, a.outcome, e.agent, file_path ORDER BY day`,
    )
    .all(filter.since, filter.since, agents, agents) as unknown as Array<{
    day: string;
    outcome: 'failure' | 'not-a-failure';
    agent: string | null;
    file_path: string | null;
    n: number;
  }>;
  return Object.freeze(
    rows.map((row) =>
      Object.freeze({
        day: row.day,
        outcome: row.outcome,
        agent: row.agent,
        filePath: row.file_path === '' ? null : row.file_path,
        count: row.n,
      }),
    ),
  );
}

export interface FailureForClusterRow {
  readonly id: number;
  readonly filePath: string;
  readonly category: string | null;
  readonly status: string;
  readonly agent: string | null;
  readonly aiContent: string;
  readonly finalContent: string;
}

/** Individual failures (with content) for on-read clustering in a report window. */
export function listFailuresForClustering(db: DatabaseSync, filter: ReportQueryFilter): readonly FailureForClusterRow[] {
  const agents = agentsJson(filter.agents);
  const until = filter.until ?? null;
  const rows = db
    .prepare(
      `SELECT id, file_path, category, status, agent, ai_content, final_content
       FROM failures
       WHERE status != 'dismissed'
         AND (? IS NULL OR created_at >= ?)
         AND (? IS NULL OR created_at < ?)
         AND (? IS NULL OR agent IN (SELECT value FROM json_each(?)))
       ORDER BY id`,
    )
    .all(filter.since, filter.since, until, until, agents, agents) as unknown as Array<{
    id: number;
    file_path: string;
    category: string | null;
    status: string;
    agent: string | null;
    ai_content: string;
    final_content: string;
  }>;
  return Object.freeze(
    rows.map((row) =>
      Object.freeze({
        id: row.id,
        filePath: row.file_path,
        category: row.category,
        status: row.status,
        agent: row.agent,
        aiContent: row.ai_content,
        finalContent: row.final_content,
      }),
    ),
  );
}

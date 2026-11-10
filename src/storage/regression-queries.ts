import type { DatabaseSync } from 'node:sqlite';
import type { FailureForRegression, FailureStatus, RegressionFilter } from '../regressions/types.js';

export function listFailuresForRegressions(db: DatabaseSync, filter: RegressionFilter): readonly FailureForRegression[] {
  if (filter.statuses.length === 0 || filter.limit < 1) return [];
  const statuses = JSON.stringify(filter.statuses);
  const categories = filter.categories === null ? null : JSON.stringify(filter.categories);
  const agents = filter.agents === null || filter.agents.length === 0 ? null : JSON.stringify(filter.agents);
  const rows = db
    .prepare(
      `SELECT f.id, f.created_at, f.file_path, f.commit_sha, json_extract(p.payload, '$.prompt') AS prompt,
              f.ai_content, f.final_content, f.category, f.category_reason, f.category_confidence,
              f.source, json_extract(b.payload, '$.prompt') AS feedback, f.status, f.agent
       FROM failures f LEFT JOIN events p ON p.id = f.prompt_event_id
         LEFT JOIN events b ON b.id = f.feedback_event_id
       WHERE f.status IN (SELECT value FROM json_each(?))
         AND (? IS NULL OR f.created_at >= ?)
         AND (? IS NULL OR COALESCE(f.category, 'unclassified') IN (SELECT value FROM json_each(?)))
         AND (? IS NULL OR f.agent IN (SELECT value FROM json_each(?)))
       ORDER BY f.id
       LIMIT ?`,
    )
    .all(statuses, filter.since, filter.since, categories, categories, agents, agents, filter.limit) as unknown as Array<{
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
    source: string;
    feedback: unknown;
    status: FailureStatus;
    agent: string | null;
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
        source: row.source,
        feedback: typeof row.feedback === 'string' ? row.feedback : null,
        status: row.status,
        agent: row.agent,
      }),
    ),
  );
}

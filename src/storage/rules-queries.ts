import type { DatabaseSync } from 'node:sqlite';
import type { FailureForRules, FailureStatus, RulesFilter } from '../rules/types.js';

export function listFailuresForRules(db: DatabaseSync, filter: RulesFilter): readonly FailureForRules[] {
  if (filter.statuses.length === 0 || filter.categories.length === 0) return [];
  const statuses = JSON.stringify(filter.statuses);
  const categories = JSON.stringify(filter.categories);
  const agents = filter.agents === null || filter.agents.length === 0 ? null : JSON.stringify(filter.agents);
  const rows = db
    .prepare(
      `SELECT f.id, f.file_path, f.category, f.status, f.agent, f.ai_content, f.final_content, f.category_reason
       FROM failures f
       WHERE f.status IN (SELECT value FROM json_each(?))
         AND COALESCE(f.category, 'unclassified') IN (SELECT value FROM json_each(?))
         AND (? IS NULL OR f.created_at >= ?)
         AND (? IS NULL OR f.agent IN (SELECT value FROM json_each(?)))
       ORDER BY f.id`,
    )
    .all(statuses, categories, filter.since, filter.since, agents, agents) as unknown as Array<{
    id: number;
    file_path: string;
    category: string | null;
    status: FailureStatus;
    agent: string | null;
    ai_content: string;
    final_content: string;
    category_reason: string | null;
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
        categoryReason: row.category_reason,
      }),
    ),
  );
}

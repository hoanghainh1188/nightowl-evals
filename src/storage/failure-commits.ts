import type { DatabaseSync } from 'node:sqlite';

/** Maps each non-empty failures.commit_sha to the failure ids that carry it. */
export function mapFailureIdsByCommitSha(db: DatabaseSync): ReadonlyMap<string, readonly number[]> {
  const rows = db
    .prepare(
      `SELECT id, commit_sha FROM failures
       WHERE commit_sha IS NOT NULL AND length(trim(commit_sha)) > 0`,
    )
    .all() as Array<{ id: number; commit_sha: string }>;
  const map = new Map<string, number[]>();
  for (const row of rows) {
    const sha = row.commit_sha.trim().toLowerCase();
    const list = map.get(sha) ?? [];
    list.push(row.id);
    map.set(sha, list);
  }
  return map;
}

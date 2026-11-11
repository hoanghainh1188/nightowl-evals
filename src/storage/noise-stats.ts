import type { DatabaseSync } from 'node:sqlite';
import type { NoiseStatRow } from '../noise/types.js';

export function listNoiseStats(db: DatabaseSync): readonly NoiseStatRow[] {
  const rows = db
    .prepare('SELECT reason_key, dismiss_count, confirm_count FROM noise_stats ORDER BY reason_key')
    .all() as unknown as Array<{ reason_key: string; dismiss_count: number; confirm_count: number }>;
  return Object.freeze(
    rows.map((row) =>
      Object.freeze({
        reasonKey: row.reason_key,
        dismissCount: row.dismiss_count,
        confirmCount: row.confirm_count,
      }),
    ),
  );
}

export function countAutoNoiseFailures(db: DatabaseSync, since: string | null): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM failures
       WHERE status = 'dismissed'
         AND instr(',' || noise_reasons || ',', ',auto-noise,') > 0
         AND (? IS NULL OR created_at >= ?)`,
    )
    .get(since, since) as { n: number } | undefined;
  return row?.n ?? 0;
}

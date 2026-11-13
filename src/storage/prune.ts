import type { DatabaseSync } from 'node:sqlite';

export interface PruneOptions {
  readonly olderThanDays: number;
  readonly dryRun?: boolean;
  readonly now?: Date;
}

export interface PruneResult {
  readonly cutoffDate: string;
  readonly snapshotsPruned: number;
  /** Total UTF-16/JS string length of snapshot payloads that were (or would be) cleared. */
  readonly bytesEstimated: number;
}

export const RETENTION_PROFILES = {
  short: 7,
  default: 30,
  long: 90,
} as const;

export type RetentionProfile = keyof typeof RETENTION_PROFILES;

export function isRetentionProfile(name: string): name is RetentionProfile {
  return Object.hasOwn(RETENTION_PROFILES, name);
}

export function computeCutoffDate(days: number, now: Date = new Date()): string {
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return cutoff.toISOString();
}

export interface PruneEstimate {
  readonly snapshots: number;
  readonly bytesEstimated: number;
}

const PRUNABLE_WHERE = `
  created_at < ?
    AND json_extract(payload, '$.snapshot') IS NOT NULL
`;

export function estimatePrunableSnapshots(db: DatabaseSync, cutoffDate: string): PruneEstimate {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count,
              COALESCE(SUM(length(json_extract(payload, '$.snapshot'))), 0) AS bytes
       FROM events
       WHERE ${PRUNABLE_WHERE}`,
    )
    .get(cutoffDate) as { count: number; bytes: number };
  return { snapshots: row.count, bytesEstimated: Number(row.bytes) };
}

export function countPrunableSnapshots(db: DatabaseSync, cutoffDate: string): number {
  return estimatePrunableSnapshots(db, cutoffDate).snapshots;
}

export function pruneSnapshots(db: DatabaseSync, cutoffDate: string): number {
  const stmt = db.prepare(`
    UPDATE events
    SET payload = json_set(payload, '$.snapshot', null, '$.snapshot_skipped', 'pruned')
    WHERE ${PRUNABLE_WHERE}
  `);
  const info = stmt.run(cutoffDate);
  return Number(info.changes);
}

export function vacuumDatabase(db: DatabaseSync): void {
  db.exec('VACUUM');
}

export function pruneStorage(db: DatabaseSync, options: PruneOptions): PruneResult {
  const cutoffDate = computeCutoffDate(options.olderThanDays, options.now);
  const estimate = estimatePrunableSnapshots(db, cutoffDate);
  if (options.dryRun) {
    return {
      cutoffDate,
      snapshotsPruned: estimate.snapshots,
      bytesEstimated: estimate.bytesEstimated,
    };
  }
  const count = pruneSnapshots(db, cutoffDate);
  return {
    cutoffDate,
    snapshotsPruned: count,
    bytesEstimated: estimate.bytesEstimated,
  };
}

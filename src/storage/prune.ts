import type { DatabaseSync } from 'node:sqlite';

export interface PruneOptions {
  readonly olderThanDays: number;
  readonly dryRun?: boolean;
  readonly now?: Date;
}

export interface PruneResult {
  readonly cutoffDate: string;
  readonly snapshotsPruned: number;
}

export function computeCutoffDate(days: number, now: Date = new Date()): string {
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return cutoff.toISOString();
}

export function countPrunableSnapshots(db: DatabaseSync, cutoffDate: string): number {
  const stmt = db.prepare(`
    SELECT COUNT(*) as count
    FROM events
    WHERE created_at < ?
      AND json_extract(payload, '$.snapshot') IS NOT NULL
  `);
  const row = stmt.get(cutoffDate) as { count: number };
  return row.count;
}

export function pruneSnapshots(db: DatabaseSync, cutoffDate: string): number {
  const stmt = db.prepare(`
    UPDATE events
    SET payload = json_set(payload, '$.snapshot', null, '$.snapshot_skipped', 'pruned')
    WHERE created_at < ?
      AND json_extract(payload, '$.snapshot') IS NOT NULL
  `);
  const info = stmt.run(cutoffDate);
  return Number(info.changes);
}

export function vacuumDatabase(db: DatabaseSync): void {
  db.exec('VACUUM');
}

export function pruneStorage(db: DatabaseSync, options: PruneOptions): PruneResult {
  const cutoffDate = computeCutoffDate(options.olderThanDays, options.now);
  if (options.dryRun) {
    const count = countPrunableSnapshots(db, cutoffDate);
    return { cutoffDate, snapshotsPruned: count };
  }
  const count = pruneSnapshots(db, cutoffDate);
  return { cutoffDate, snapshotsPruned: count };
}

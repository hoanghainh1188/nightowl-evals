import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrate } from '../../src/storage/migrations.js';
import {
  computeCutoffDate,
  countPrunableSnapshots,
  pruneSnapshots,
  pruneStorage,
  vacuumDatabase,
} from '../../src/storage/prune.js';

describe('storage prune', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    migrate(db);
  });

  afterEach(() => {
    db.close();
  });

  function insertEvent(createdAt: string, snapshot: string | null) {
    const payload = JSON.stringify(
      snapshot === null
        ? { file_path: 'src/a.ts', snapshot: null, snapshot_skipped: 'too_large' }
        : { file_path: 'src/a.ts', snapshot, snapshot_skipped: null },
    );
    db.prepare(`
      INSERT INTO events (created_at, source, kind, file_path, payload)
      VALUES (?, 'claude-code', 'edit', 'src/a.ts', ?)
    `).run(createdAt, payload);
  }

  it('computes cutoff date correctly from given now and days', () => {
    const now = new Date('2026-11-09T12:00:00.000Z');
    const cutoff = computeCutoffDate(30, now);
    expect(cutoff).toBe('2026-10-10T12:00:00.000Z');
  });

  it('counts prunable snapshots older than cutoff date', () => {
    insertEvent('2026-09-01T00:00:00.000Z', 'old snapshot 1');
    insertEvent('2026-09-15T00:00:00.000Z', 'old snapshot 2');
    insertEvent('2026-09-20T00:00:00.000Z', null); // Already null snapshot
    insertEvent('2026-11-05T00:00:00.000Z', 'new snapshot');

    const cutoff = '2026-10-01T00:00:00.000Z';
    const count = countPrunableSnapshots(db, cutoff);
    expect(count).toBe(2);
  });

  it('prunes snapshots older than cutoff while keeping newer snapshots intact', () => {
    insertEvent('2026-09-01T00:00:00.000Z', 'old snapshot 1');
    insertEvent('2026-09-15T00:00:00.000Z', 'old snapshot 2');
    insertEvent('2026-11-05T00:00:00.000Z', 'new snapshot');

    const cutoff = '2026-10-01T00:00:00.000Z';
    const pruned = pruneSnapshots(db, cutoff);
    expect(pruned).toBe(2);

    const rows = db.prepare('SELECT created_at, payload FROM events ORDER BY created_at ASC').all() as Array<{
      created_at: string;
      payload: string;
    }>;
    expect(rows).toHaveLength(3);

    const first = JSON.parse(rows[0]!.payload);
    expect(first.snapshot).toBeNull();
    expect(first.snapshot_skipped).toBe('pruned');

    const second = JSON.parse(rows[1]!.payload);
    expect(second.snapshot).toBeNull();
    expect(second.snapshot_skipped).toBe('pruned');

    const third = JSON.parse(rows[2]!.payload);
    expect(third.snapshot).toBe('new snapshot');
    expect(third.snapshot_skipped).toBeNull();
  });

  it('supports dry-run mode without modifying the database', () => {
    insertEvent('2026-09-01T00:00:00.000Z', 'old snapshot');
    const now = new Date('2026-11-09T12:00:00.000Z');

    const result = pruneStorage(db, { olderThanDays: 30, dryRun: true, now });
    expect(result.snapshotsPruned).toBe(1);
    expect(result.cutoffDate).toBe('2026-10-10T12:00:00.000Z');

    const row = db.prepare('SELECT payload FROM events').get() as { payload: string };
    const payload = JSON.parse(row.payload);
    expect(payload.snapshot).toBe('old snapshot');
  });

  it('executes vacuum successfully', () => {
    insertEvent('2026-09-01T00:00:00.000Z', 'old snapshot');
    pruneSnapshots(db, '2026-10-01T00:00:00.000Z');
    expect(() => vacuumDatabase(db)).not.toThrow();
  });
});

import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { mkdir } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrations } from '../../src/storage/migrations.js';
import { openStore } from '../../src/storage/store.js';
import { createFakeRepo, type TempDir } from '../helpers/temp-repo.js';

function columns(db: DatabaseSync, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((row) => row.name);
}

describe('schema v1 → v2', () => {
  let repo: TempDir;
  let dbFile: string;

  beforeEach(async () => {
    repo = await createFakeRepo();
    await mkdir(join(repo.path, '.nightowl'), { mode: 0o700 });
    dbFile = join(repo.path, '.nightowl', 'nightowl.db');
    const db = new DatabaseSync(dbFile);
    db.exec(migrations[0] as string);
    db.exec(`INSERT INTO events (created_at, source, kind, file_path, payload) VALUES ('t', 'claude-code', 'edit', 'a.ts', '{}')`);
    db.exec(`INSERT INTO failures (created_at, file_path, ai_event_id, ai_content, final_content) VALUES ('t', 'a.ts', 1, 'x', 'y')`);
    db.exec('PRAGMA user_version = 1');
    db.close();
  });
  afterEach(() => repo.cleanup());

  it('adds prompt_event_id and checks_attached and keeps v1 data', async () => {
    (await openStore({ cwd: repo.path })).close();
    const db = new DatabaseSync(dbFile);
    try {
      expect(columns(db, 'failures')).toContain('prompt_event_id');
      expect(columns(db, 'checks_attached')).toEqual(['check_id', 'outcome', 'commit_sha', 'failure_id']);
      expect(db.prepare('SELECT file_path, ai_content, prompt_event_id FROM failures').all()).toEqual([
        { file_path: 'a.ts', ai_content: 'x', prompt_event_id: null },
      ]);
      expect((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(2);
    } finally {
      db.close();
    }
  });

  it('changes nothing when reopened', async () => {
    (await openStore({ cwd: repo.path })).close();
    (await openStore({ cwd: repo.path })).close();
    const db = new DatabaseSync(dbFile);
    try {
      expect(db.prepare('SELECT COUNT(*) AS n FROM failures').get()).toEqual({ n: 1 });
    } finally {
      db.close();
    }
  });

  it('rejects an unknown checks_attached outcome', async () => {
    (await openStore({ cwd: repo.path })).close();
    const db = new DatabaseSync(dbFile);
    try {
      expect(() => db.exec(`INSERT INTO checks_attached (check_id, outcome) VALUES (1, 'maybe')`)).toThrow();
    } finally {
      db.close();
    }
  });
});

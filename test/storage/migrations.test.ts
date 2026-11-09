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

describe('schema v1 → current', () => {
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
      expect((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(5);
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

describe('schema v2 → v3', () => {
  let repo: TempDir;
  let dbFile: string;

  beforeEach(async () => {
    repo = await createFakeRepo();
    await mkdir(join(repo.path, '.nightowl'), { mode: 0o700 });
    dbFile = join(repo.path, '.nightowl', 'nightowl.db');
    const db = new DatabaseSync(dbFile);
    db.exec(migrations[0] as string);
    db.exec(migrations[1] as string);
    db.exec(`INSERT INTO failures (created_at, file_path, ai_content, final_content, category) VALUES ('t', 'a.ts', 'x', 'y', 'logic')`);
    db.exec('PRAGMA user_version = 2');
    db.close();
  });
  afterEach(() => repo.cleanup());

  it('adds the classification columns and keeps v2 data', async () => {
    (await openStore({ cwd: repo.path })).close();
    const db = new DatabaseSync(dbFile);
    try {
      expect(columns(db, 'failures')).toEqual(
        expect.arrayContaining(['category_reason', 'category_confidence', 'classified_at', 'classifier']),
      );
      expect(db.prepare('SELECT category, category_reason, classifier FROM failures').all()).toEqual([
        { category: 'logic', category_reason: null, classifier: null },
      ]);
    } finally {
      db.close();
    }
  });

  it.each([-0.1, 1.5])('rejects a confidence of %s', async (value) => {
    (await openStore({ cwd: repo.path })).close();
    const db = new DatabaseSync(dbFile);
    try {
      expect(() => db.exec(`UPDATE failures SET category_confidence = ${value}`)).toThrow();
      db.exec('UPDATE failures SET category_confidence = 0.5');
    } finally {
      db.close();
    }
  });
});

describe('migration v3 to v4', () => {
  let repo: TempDir;
  let dbFile: string;

  beforeEach(async () => {
    repo = await createFakeRepo();
    await mkdir(join(repo.path, '.nightowl'), { mode: 0o700 });
    dbFile = join(repo.path, '.nightowl', 'nightowl.db');
    const db = new DatabaseSync(dbFile);
    for (const sql of migrations.slice(0, 3)) db.exec(sql);
    db.exec(`INSERT INTO failures (created_at, file_path, ai_content, final_content) VALUES ('t', 'a.ts', 'x', 'y'), ('t', 'b.ts', 'x', 'y')`);
    db.exec('PRAGMA user_version = 3');
    db.close();
  });
  afterEach(() => repo.cleanup());

  it('marks existing failures as manual fixes', async () => {
    (await openStore({ cwd: repo.path })).close();
    const db = new DatabaseSync(dbFile);
    try {
      expect((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(5);
      expect(db.prepare('SELECT source, feedback_event_id FROM failures').all()).toEqual([
        { source: 'manual-fix', feedback_event_id: null },
        { source: 'manual-fix', feedback_event_id: null },
      ]);
    } finally {
      db.close();
    }
  });

  it('rejects an unknown source', async () => {
    (await openStore({ cwd: repo.path })).close();
    const db = new DatabaseSync(dbFile);
    try {
      expect(() => db.exec(`UPDATE failures SET source = 'other'`)).toThrow();
      db.exec(`UPDATE failures SET source = 'ai-self-fix'`);
    } finally {
      db.close();
    }
  });
});

describe('migration v4 to v5', () => {
  let repo: Awaited<ReturnType<typeof createFakeRepo>>;
  let dbFile: string;

  beforeEach(async () => {
    repo = await createFakeRepo();
    await mkdir(join(repo.path, '.nightowl'), { mode: 0o700 });
    dbFile = join(repo.path, '.nightowl', 'nightowl.db');
    const db = new DatabaseSync(dbFile);
    for (const sql of migrations.slice(0, 4)) db.exec(sql);
    db.exec(`INSERT INTO events (created_at, source, kind, file_path, payload) VALUES ('t', 'claude-code', 'edit', 'a.ts', '{}')`);
    db.exec(`INSERT INTO events (created_at, source, kind, file_path, payload) VALUES ('t', 'git', 'commit-check', 'a.ts', '{}')`);
    db.exec(`INSERT INTO failures (created_at, file_path, ai_event_id, ai_content, final_content) VALUES ('t', 'a.ts', 1, 'x', 'y')`);
    db.exec('PRAGMA user_version = 4');
    db.close();
  });
  afterEach(() => repo.cleanup());

  it('maps claude-code to agent-hook and fills agent', async () => {
    (await openStore({ cwd: repo.path })).close();
    const db = new DatabaseSync(dbFile);
    try {
      expect((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(5);
      expect(columns(db, 'events')).toContain('agent');
      expect(columns(db, 'failures')).toContain('agent');
      expect(db.prepare('SELECT source, agent FROM events ORDER BY id').all()).toEqual([
        { source: 'agent-hook', agent: 'claude-code' },
        { source: 'git', agent: null },
      ]);
      expect(db.prepare('SELECT agent FROM failures').all()).toEqual([{ agent: 'claude-code' }]);
    } finally {
      db.close();
    }
  });
});

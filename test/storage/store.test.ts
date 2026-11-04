import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION } from '../../src/storage/migrations.js';
import { openStore, ProjectNotFoundError, SchemaTooNewError, type Store } from '../../src/storage/store.js';
import { buildProbe } from '../helpers/build-probe.js';
import { createFakeRepo, createTempDir, type TempDir } from '../helpers/temp-repo.js';

function dbPath(root: string): string {
  return join(root, '.nightowl', 'nightowl.db');
}

function rawQuery<T>(root: string, sql: string): T[] {
  const db = new DatabaseSync(dbPath(root));
  try {
    return db.prepare(sql).all() as T[];
  } finally {
    db.close();
  }
}

async function listFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(root, join(entry.parentPath, entry.name)))
    .sort();
}

describe('openStore', () => {
  let repo: TempDir;
  let store: Store | undefined;

  beforeEach(async () => {
    repo = await createFakeRepo();
  });

  afterEach(async () => {
    store?.close();
    store = undefined;
    await repo.cleanup();
  });

  it('creates .nightowl/nightowl.db at the repository root', async () => {
    store = await openStore({ cwd: repo.path });
    expect(store.root).toBe(repo.path);
    expect(await listFiles(join(repo.path, '.nightowl'))).toContain('nightowl.db');
  });

  it('uses the repository root when opened from a subdirectory', async () => {
    const nested = join(repo.path, 'src', 'feature');
    await import('node:fs/promises').then((fs) => fs.mkdir(nested, { recursive: true }));
    store = await openStore({ cwd: nested });
    expect(store.root).toBe(repo.path);
    expect(await listFiles(nested)).toEqual([]);
  });

  it('refuses to open outside a repository and creates nothing', async () => {
    const outside = await createTempDir();
    try {
      await expect(openStore({ cwd: outside.path })).rejects.toBeInstanceOf(ProjectNotFoundError);
      expect(await listFiles(outside.path)).toEqual([]);
    } finally {
      await outside.cleanup();
    }
  });

  it('enables WAL and a busy timeout', async () => {
    store = await openStore({ cwd: repo.path });
    expect(store.pragma('journal_mode')).toBe('wal');
    expect(store.pragma('busy_timeout')).toBe(2000);
    expect(store.pragma('foreign_keys')).toBe(1);
  });

  it('keeps .nightowl/ private to the current user', async () => {
    store = await openStore({ cwd: repo.path });
    const { stat } = await import('node:fs/promises');
    expect((await stat(join(repo.path, '.nightowl'))).mode & 0o777).toBe(0o700);
  });

  it('tightens an existing .nightowl/ that others can read', async () => {
    const fs = await import('node:fs/promises');
    await fs.mkdir(join(repo.path, '.nightowl'), { mode: 0o755 });
    await fs.chmod(join(repo.path, '.nightowl'), 0o755);
    store = await openStore({ cwd: repo.path });
    expect((await fs.stat(join(repo.path, '.nightowl'))).mode & 0o777).toBe(0o700);
  });

  it('refuses a .nightowl that is a symlink', async () => {
    const outside = await createTempDir();
    try {
      const fs = await import('node:fs/promises');
      await fs.symlink(outside.path, join(repo.path, '.nightowl'));
      await expect(openStore({ cwd: repo.path })).rejects.toThrow(/symlink/i);
      expect(await listFiles(outside.path)).toEqual([]);
    } finally {
      await outside.cleanup();
    }
  });

  it('caps the busy timeout at the time the caller has left', async () => {
    store = await openStore({ cwd: repo.path, timeoutMs: 300 });
    expect(store.pragma('busy_timeout')).toBe(300);
  });

  it('only answers the pragmas it knows', async () => {
    store = await openStore({ cwd: repo.path });
    expect(() => store?.pragma('user_version; DROP TABLE events')).toThrow(/unsupported pragma/i);
  });
});

describe('schema', () => {
  let repo: TempDir;

  beforeEach(async () => {
    repo = await createFakeRepo();
  });

  afterEach(() => repo.cleanup());

  it('creates all tables and indexes at the current version', async () => {
    (await openStore({ cwd: repo.path })).close();
    const names = rawQuery<{ name: string }>(
      repo.path,
      "SELECT name FROM sqlite_master WHERE type IN ('table', 'index') AND name NOT LIKE 'sqlite_%' ORDER BY name",
    ).map((row) => row.name);
    expect(names).toEqual(['checked_edits', 'checks_attached', 'events', 'events_file_time', 'events_session', 'failures']);
    expect(rawQuery<{ user_version: number }>(repo.path, 'PRAGMA user_version')[0]?.user_version).toBe(2);
    expect(CURRENT_SCHEMA_VERSION).toBe(2);
  });

  it('leaves data and version untouched when reopened', async () => {
    const first = await openStore({ cwd: repo.path });
    first.insertEvent({ source: 'git', kind: 'commit-check', payload: { ok: true } });
    first.close();
    const second = await openStore({ cwd: repo.path });
    expect(second.listEvents()).toHaveLength(1);
    second.close();
    expect(rawQuery<{ user_version: number }>(repo.path, 'PRAGMA user_version')[0]?.user_version).toBe(2);
  });

  it('refuses a database written by a newer NightOwl without changing it', async () => {
    (await openStore({ cwd: repo.path })).close();
    const db = new DatabaseSync(dbPath(repo.path));
    db.exec('PRAGMA user_version = 99');
    db.close();
    await expect(openStore({ cwd: repo.path })).rejects.toBeInstanceOf(SchemaTooNewError);
    expect(rawQuery<{ user_version: number }>(repo.path, 'PRAGMA user_version')[0]?.user_version).toBe(99);
  });

  it.each([
    ['an unknown source', "INSERT INTO events (created_at, source, kind, payload) VALUES ('t', 'cursor', 'edit', '{}')"],
    ['a non-JSON payload', "INSERT INTO events (created_at, source, kind, payload) VALUES ('t', 'git', 'edit', 'nope')"],
    [
      'an unknown failure category',
      "INSERT INTO failures (created_at, file_path, ai_content, final_content, category) VALUES ('t', 'a', 'x', 'y', 'typo')",
    ],
    [
      'an unknown failure status',
      "INSERT INTO failures (created_at, file_path, ai_content, final_content, status) VALUES ('t', 'a', 'x', 'y', 'open')",
    ],
  ])('rejects %s', async (_label, sql) => {
    (await openStore({ cwd: repo.path })).close();
    const db = new DatabaseSync(dbPath(repo.path));
    try {
      expect(() => db.exec(sql)).toThrow(/CHECK constraint failed/);
    } finally {
      db.close();
    }
  });

  it('accepts a flagged failure with no category yet', async () => {
    (await openStore({ cwd: repo.path })).close();
    const db = new DatabaseSync(dbPath(repo.path));
    db.exec("INSERT INTO failures (created_at, file_path, ai_content, final_content) VALUES ('t', 'a.ts', 'x', 'y')");
    const row = db.prepare('SELECT category, status FROM failures').get();
    db.close();
    expect(row).toEqual({ category: null, status: 'flagged' });
  });
});

describe('events', () => {
  let repo: TempDir;
  let store: Store;

  beforeEach(async () => {
    repo = await createFakeRepo();
    store = await openStore({ cwd: repo.path });
  });

  afterEach(async () => {
    store.close();
    await repo.cleanup();
  });

  it('round-trips every field', () => {
    const saved = store.insertEvent({
      source: 'claude-code',
      kind: 'edit',
      sessionId: 's1',
      filePath: 'src/a.ts',
      payload: { tool: 'Edit', nested: { n: 1 } },
    });
    expect(saved.id).toBeGreaterThan(0);
    expect(saved.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(Object.isFrozen(saved)).toBe(true);
    expect(store.listEvents()).toEqual([saved]);
    expect(saved).toMatchObject({
      source: 'claude-code',
      kind: 'edit',
      sessionId: 's1',
      filePath: 'src/a.ts',
      payload: { tool: 'Edit', nested: { n: 1 } },
    });
  });

  it('defaults missing session and file to null', () => {
    const saved = store.insertEvent({ source: 'git', kind: 'commit-check', payload: {} });
    expect(saved.sessionId).toBeNull();
    expect(saved.filePath).toBeNull();
  });

  it('filters by file, kind and time, oldest first', () => {
    store.insertEvent({ source: 'claude-code', kind: 'prompt', payload: {}, createdAt: '2026-11-01T00:00:00.000Z' });
    const a = store.insertEvent({
      source: 'claude-code',
      kind: 'edit',
      filePath: 'a.ts',
      payload: {},
      createdAt: '2026-11-02T00:00:00.000Z',
    });
    const b = store.insertEvent({
      source: 'claude-code',
      kind: 'edit',
      filePath: 'a.ts',
      payload: {},
      createdAt: '2026-11-03T00:00:00.000Z',
    });
    store.insertEvent({ source: 'claude-code', kind: 'edit', filePath: 'b.ts', payload: {} });

    expect(store.listEvents({ filePath: 'a.ts' }).map((e) => e.id)).toEqual([a.id, b.id]);
    expect(store.listEvents({ kinds: ['prompt'] })).toHaveLength(1);
    expect(store.listEvents({ filePath: 'a.ts', since: '2026-11-03T00:00:00.000Z' }).map((e) => e.id)).toEqual([b.id]);
    expect(store.listEvents({ kinds: [] })).toEqual([]);
  });

  it('only creates files inside .nightowl/', async () => {
    store.insertEvent({ source: 'claude-code', kind: 'edit', filePath: 'a.ts', payload: {} });
    const files = (await listFiles(repo.path)).filter((file) => !file.startsWith('.git'));
    expect(files.length).toBeGreaterThan(0);
    expect(files.every((file) => file.startsWith('.nightowl/'))).toBe(true);
  });
});

describe('concurrent writers', () => {
  let probe: Awaited<ReturnType<typeof buildProbe>>;
  let repo: TempDir;

  beforeAll(async () => {
    probe = await buildProbe('open-store');
    repo = await createFakeRepo();
  }, 60_000);

  afterAll(async () => {
    await probe.cleanup();
    await repo.cleanup();
  });

  function writer(tag: string): Promise<number | null> {
    return new Promise((resolve) => {
      const child = spawn(process.execPath, [probe.file, repo.path, '50', tag], { stdio: 'ignore' });
      child.on('close', resolve);
    });
  }

  it('keeps every event when two processes write at once', async () => {
    expect(await Promise.all([writer('one'), writer('two')])).toEqual([0, 0]);
    const store = await openStore({ cwd: repo.path });
    try {
      expect(store.listEvents()).toHaveLength(100);
      expect(store.listEvents({ filePath: 'one.ts' })).toHaveLength(50);
    } finally {
      store.close();
    }
  }, 30_000);
});

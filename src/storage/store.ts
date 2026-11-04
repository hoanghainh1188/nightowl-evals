import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  type EventFilter,
  insertEvent,
  listEvents,
  listUncheckedEdits,
  type NewEvent,
  type StoredEvent,
} from './events.js';
import { retryWhileBusy } from './busy.js';
import { migrate } from './migrations.js';
import { findProjectRoot } from './project-root.js';
import { loadSqlite } from './sqlite.js';

export { SchemaTooNewError } from './migrations.js';

export const DATA_DIR = '.nightowl';
export const DB_FILE = 'nightowl.db';
const BUSY_TIMEOUT_MS = 2000;
export class ProjectNotFoundError extends Error {
  constructor(readonly cwd: string) {
    super(`No git repository found at or above ${cwd}`);
    this.name = 'ProjectNotFoundError';
  }
}

export interface Store {
  readonly root: string;
  readonly insertEvent: (event: NewEvent) => StoredEvent;
  readonly listEvents: (filter?: EventFilter) => readonly StoredEvent[];
  readonly listUncheckedEdits: (filePaths: readonly string[]) => readonly StoredEvent[];
  readonly pragma: (name: string) => unknown;
  readonly close: () => void;
}

export async function openStore(options: { readonly cwd?: string } = {}): Promise<Store> {
  const cwd = options.cwd ?? process.cwd();
  const root = findProjectRoot(cwd);
  if (root === null) throw new ProjectNotFoundError(cwd);

  const { DatabaseSync } = await loadSqlite();
  const dataDir = join(root, DATA_DIR);
  mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(join(dataDir, DB_FILE));
  try {
    db.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);
    db.exec('PRAGMA foreign_keys = ON');
    await retryWhileBusy(() => {
      db.exec('PRAGMA journal_mode = WAL');
      db.exec('PRAGMA synchronous = NORMAL');
      migrate(db);
    }, BUSY_TIMEOUT_MS);
  } catch (error) {
    db.close();
    throw error;
  }

  return Object.freeze({
    root,
    insertEvent: (event: NewEvent) => insertEvent(db, event),
    listEvents: (filter?: EventFilter) => listEvents(db, filter),
    listUncheckedEdits: (filePaths: readonly string[]) => listUncheckedEdits(db, filePaths),
    pragma: (name: string) => {
      const row = db.prepare(`PRAGMA ${name}`).get() as Record<string, unknown> | undefined;
      return row === undefined ? undefined : Object.values(row)[0];
    },
    close: () => db.close(),
  });
}

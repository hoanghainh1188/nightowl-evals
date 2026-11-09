import { join } from 'node:path';
import { retryWhileBusy } from './busy.js';
import { DATA_DIR, ensureDataDir } from './data-dir.js';
import {
  type EventFilter,
  getSnapshot,
  insertEvent,
  listEvents,
  listOpenEdits,
  listUncheckedEdits,
  type NewEvent,
  type PendingEdit,
  recordCommitCheck,
  type StoredEvent,
} from './events.js';
import {
  type Attachment,
  attachChecks,
  countFailures,
  type FailureCounts,
  type ExportFilter,
  type FailureToClassify,
  type FailureToExport,
  findPromptBefore,
  findPromptBetween,
  isFeedbackFor,
  getEventPayload,
  listFailuresToClassify,
  listFailuresToExport,
  listUnattachedChecks,
  type SavedClassification,
  recordClassifyError,
  saveClassification,
  type UnattachedCheck,
} from './failures.js';
import { CURRENT_SCHEMA_VERSION, migrate, SchemaTooNewError } from './migrations.js';
import { type PruneOptions, type PruneResult, pruneStorage, vacuumDatabase } from './prune.js';
import { type CheckCountRow, countChecksForReport, countFailuresForReport, type FailureCountRow } from './report-queries.js';
import {
  type FailureForReview,
  type FailureStatus,
  getFailureForReview,
  listFailuresForReview,
  type ReviewFilter,
  setFailureStatus,
  type StatusChange,
} from './review-queries.js';
import { findProjectRoot } from './project-root.js';
import { loadSqlite } from './sqlite.js';

export { SchemaTooNewError } from './migrations.js';

export { DATA_DIR, DataDirError } from './data-dir.js';
export const DB_FILE = 'nightowl.db';
const BUSY_TIMEOUT_MS = 2000;
const READABLE_PRAGMAS = new Set(['journal_mode', 'busy_timeout', 'foreign_keys', 'user_version', 'synchronous']);

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
  readonly listUncheckedEdits: (filePaths: readonly string[]) => readonly PendingEdit[];
  readonly listOpenEdits: (filePath: string) => readonly PendingEdit[];
  readonly getSnapshot: (editId: number) => string | null;
  readonly recordCommitCheck: (event: NewEvent, editIds: readonly number[]) => StoredEvent;
  readonly listUnattachedChecks: () => readonly UnattachedCheck[];
  readonly getEventPayload: (id: number) => unknown;
  readonly findPromptBefore: (editId: number) => number | null;
  readonly findPromptBetween: (afterEditId: number, beforeEditId: number) => number | null;
  readonly isFeedbackFor: (editId: number, feedbackId: number, filePath: string) => boolean;
  readonly attachChecks: (commitSha: string, attachments: readonly Attachment[]) => number;
  readonly countFailures: () => FailureCounts;
  readonly listFailuresToClassify: (limit: number, redo: boolean) => readonly FailureToClassify[];
  readonly saveClassification: (failureId: number, value: SavedClassification) => void;
  readonly recordClassifyError: (failureId: number, error: string) => void;
  readonly listFailuresToExport: (filter: ExportFilter) => readonly FailureToExport[];
  readonly countFailuresForReport: (since: string | null) => readonly FailureCountRow[];
  readonly countChecksForReport: (since: string | null) => readonly CheckCountRow[];
  readonly listFailuresForReview: (filter: ReviewFilter) => readonly FailureForReview[];
  readonly getFailureForReview: (id: number) => FailureForReview | null;
  readonly setFailureStatus: (ids: readonly number[], status: FailureStatus) => StatusChange;
  readonly prune: (options: PruneOptions) => PruneResult;
  readonly vacuum: () => void;
  // Hooks shorten the lock wait to what is left of their budget before writing.
  readonly setBusyTimeout: (ms: number) => void;
  readonly pragma: (name: string) => unknown;
  readonly close: () => void;
}

export interface OpenStoreOptions {
  readonly cwd?: string;
  // Upper bound on waiting for other writers; hooks pass what is left of their budget.
  readonly timeoutMs?: number;
  // Opens an existing, up-to-date database without creating, migrating or writing anything.
  readonly readOnly?: boolean;
}

export class SchemaOutdatedError extends Error {
  constructor(readonly found: number) {
    super(`NightOwl database schema v${found} is older than v${CURRENT_SCHEMA_VERSION}. Run 'nightowl init' to upgrade it.`);
    this.name = 'SchemaOutdatedError';
  }
}

function openReadOnly(DatabaseSync: typeof import('node:sqlite').DatabaseSync, path: string, waitMs: number) {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    db.exec(`PRAGMA busy_timeout = ${waitMs}`);
    const version = (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
    if (version > CURRENT_SCHEMA_VERSION) throw new SchemaTooNewError(version);
    if (version < CURRENT_SCHEMA_VERSION) throw new SchemaOutdatedError(version);
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

export async function openStore(options: OpenStoreOptions = {}): Promise<Store> {
  const cwd = options.cwd ?? process.cwd();
  const waitMs = Math.max(1, Math.min(BUSY_TIMEOUT_MS, Math.floor(options.timeoutMs ?? BUSY_TIMEOUT_MS)));
  const root = findProjectRoot(cwd);
  if (root === null) throw new ProjectNotFoundError(cwd);

  const { DatabaseSync } = await loadSqlite();
  if (options.readOnly) return storeApi(openReadOnly(DatabaseSync, join(root, DATA_DIR, DB_FILE), waitMs), root);
  const db = new DatabaseSync(join(ensureDataDir(root), DB_FILE));
  try {
    db.exec(`PRAGMA busy_timeout = ${waitMs}`);
    db.exec('PRAGMA foreign_keys = ON');
    await retryWhileBusy(() => {
      db.exec('PRAGMA journal_mode = WAL');
      db.exec('PRAGMA synchronous = NORMAL');
      migrate(db);
    }, waitMs);
  } catch (error) {
    db.close();
    throw error;
  }
  return storeApi(db, root);
}

function storeApi(db: import('node:sqlite').DatabaseSync, root: string): Store {
  return Object.freeze({
    root,
    insertEvent: (event: NewEvent) => insertEvent(db, event),
    listEvents: (filter?: EventFilter) => listEvents(db, filter),
    listUncheckedEdits: (filePaths: readonly string[]) => listUncheckedEdits(db, filePaths),
    listOpenEdits: (filePath: string) => listOpenEdits(db, filePath),
    getSnapshot: (editId: number) => getSnapshot(db, editId),
    recordCommitCheck: (event: NewEvent, editIds: readonly number[]) => recordCommitCheck(db, event, editIds),
    listUnattachedChecks: () => listUnattachedChecks(db),
    getEventPayload: (id: number) => getEventPayload(db, id),
    findPromptBefore: (editId: number) => findPromptBefore(db, editId),
    findPromptBetween: (afterEditId: number, beforeEditId: number) => findPromptBetween(db, afterEditId, beforeEditId),
    isFeedbackFor: (editId: number, feedbackId: number, filePath: string) => isFeedbackFor(db, editId, feedbackId, filePath),
    attachChecks: (commitSha: string, attachments: readonly Attachment[]) => attachChecks(db, commitSha, attachments),
    countFailures: () => countFailures(db),
    listFailuresToClassify: (limit: number, redo: boolean) => listFailuresToClassify(db, limit, redo),
    saveClassification: (failureId: number, value: SavedClassification) => saveClassification(db, failureId, value),
    recordClassifyError: (failureId: number, error: string) => recordClassifyError(db, failureId, error),
    listFailuresToExport: (filter: ExportFilter) => listFailuresToExport(db, filter),
    countFailuresForReport: (since: string | null) => countFailuresForReport(db, since),
    countChecksForReport: (since: string | null) => countChecksForReport(db, since),
    listFailuresForReview: (filter: ReviewFilter) => listFailuresForReview(db, filter),
    getFailureForReview: (id: number) => getFailureForReview(db, id),
    setFailureStatus: (ids: readonly number[], status: FailureStatus) => setFailureStatus(db, ids, status),
    prune: (options: PruneOptions) => pruneStorage(db, options),
    vacuum: () => vacuumDatabase(db),
    setBusyTimeout: (ms: number) => db.exec(`PRAGMA busy_timeout = ${Math.max(1, Math.floor(ms))}`),
    pragma: (name: string) => {
      if (!READABLE_PRAGMAS.has(name)) throw new Error(`Unsupported pragma: ${name}`);
      const row = db.prepare(`PRAGMA ${name}`).get() as Record<string, unknown> | undefined;
      return row === undefined ? undefined : Object.values(row)[0];
    },
    close: () => db.close(),
  });
}

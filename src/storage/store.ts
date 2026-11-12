import { join } from 'node:path';
import { retryWhileBusy } from './busy.js';
import { DATA_DIR, ensureDataDir } from './data-dir.js';
import type { AnyAgentId } from '../agents/ids.js';
import {
  countEventsByKind,
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
import {
  type CheckCountRow,
  countChecksForReport,
  countFailuresForReport,
  type FailureCountRow,
  type FailureForClusterRow,
  listFailuresForClustering,
} from './report-queries.js';
import {
  type FailureForReview,
  type FailureStatus,
  getFailureForReview,
  listFailuresForReview,
  type ReviewFilter,
  setFailureStatus,
  type StatusChange,
} from './review-queries.js';
import { listFailuresForRules } from './rules-queries.js';
import type { FailureForRules, RulesFilter } from '../rules/types.js';
import { listFailuresForRegressions } from './regression-queries.js';
import type { FailureForRegression, RegressionFilter } from '../regressions/types.js';
import { countFailuresInWindow, type FailureWindowFilter } from './impact-queries.js';
import { countAutoNoiseFailures, listNoiseStats } from './noise-stats.js';
import type { NoiseStatRow } from '../noise/types.js';
import {
  getLatestRuleApplication,
  getRuleApplicationById,
  getRuleApplicationByLabel,
  listRuleApplications,
  type RuleApplication,
  type RuleBaseline,
  type UpsertRuleApplicationInput,
  upsertRuleApplication,
} from './rule-applications.js';
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
  readonly countEventsByKind: (kinds: readonly string[], since: string | null) => Readonly<Record<string, number>>;
  readonly listUncheckedEdits: (filePaths: readonly string[]) => readonly PendingEdit[];
  readonly listOpenEdits: (filePath: string, agent?: AnyAgentId | null) => readonly PendingEdit[];
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
  readonly countFailuresForReport: (since: string | null, agents?: readonly string[] | null) => readonly FailureCountRow[];
  readonly countChecksForReport: (since: string | null, agents?: readonly string[] | null) => readonly CheckCountRow[];
  readonly listFailuresForClustering: (since: string | null, agents?: readonly string[] | null) => readonly FailureForClusterRow[];
  readonly countAutoNoiseFailures: (since: string | null) => number;
  readonly listNoiseStats: () => readonly NoiseStatRow[];
  readonly listFailuresForReview: (filter: ReviewFilter) => readonly FailureForReview[];
  readonly listFailuresForRules: (filter: RulesFilter) => readonly FailureForRules[];
  readonly listFailuresForRegressions: (filter: RegressionFilter) => readonly FailureForRegression[];
  readonly getFailureForReview: (id: number) => FailureForReview | null;
  readonly setFailureStatus: (ids: readonly number[], status: FailureStatus) => StatusChange;
  readonly prune: (options: PruneOptions) => PruneResult;
  readonly vacuum: () => void;
  readonly upsertRuleApplication: (input: UpsertRuleApplicationInput) => RuleApplication;
  readonly getRuleApplicationById: (id: number) => RuleApplication | null;
  readonly getRuleApplicationByLabel: (label: string) => RuleApplication | null;
  readonly getLatestRuleApplication: () => RuleApplication | null;
  readonly listRuleApplications: () => readonly RuleApplication[];
  readonly countFailuresInWindow: (filter: FailureWindowFilter) => RuleBaseline;
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
    countEventsByKind: (kinds: readonly string[], since: string | null) => countEventsByKind(db, kinds, since),
    listUncheckedEdits: (filePaths: readonly string[]) => listUncheckedEdits(db, filePaths),
    listOpenEdits: (filePath: string, agent?: AnyAgentId | null) => listOpenEdits(db, filePath, agent),
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
    countFailuresForReport: (since: string | null, agents: readonly string[] | null = null) =>
      countFailuresForReport(db, { since, agents }),
    countChecksForReport: (since: string | null, agents: readonly string[] | null = null) =>
      countChecksForReport(db, { since, agents }),
    listFailuresForClustering: (since: string | null, agents: readonly string[] | null = null) =>
      listFailuresForClustering(db, { since, agents }),
    countAutoNoiseFailures: (since: string | null) => countAutoNoiseFailures(db, since),
    listNoiseStats: () => listNoiseStats(db),
    listFailuresForReview: (filter: ReviewFilter) => listFailuresForReview(db, filter),
    listFailuresForRules: (filter: RulesFilter) => listFailuresForRules(db, filter),
    listFailuresForRegressions: (filter: RegressionFilter) => listFailuresForRegressions(db, filter),
    getFailureForReview: (id: number) => getFailureForReview(db, id),
    setFailureStatus: (ids: readonly number[], status: FailureStatus) => setFailureStatus(db, ids, status),
    prune: (options: PruneOptions) => pruneStorage(db, options),
    vacuum: () => vacuumDatabase(db),
    upsertRuleApplication: (input: UpsertRuleApplicationInput) => upsertRuleApplication(db, input),
    getRuleApplicationById: (id: number) => getRuleApplicationById(db, id),
    getRuleApplicationByLabel: (label: string) => getRuleApplicationByLabel(db, label),
    getLatestRuleApplication: () => getLatestRuleApplication(db),
    listRuleApplications: () => listRuleApplications(db),
    countFailuresInWindow: (filter: FailureWindowFilter) => countFailuresInWindow(db, filter),
    setBusyTimeout: (ms: number) => db.exec(`PRAGMA busy_timeout = ${Math.max(1, Math.floor(ms))}`),
    pragma: (name: string) => {
      if (!READABLE_PRAGMAS.has(name)) throw new Error(`Unsupported pragma: ${name}`);
      const row = db.prepare(`PRAGMA ${name}`).get() as Record<string, unknown> | undefined;
      return row === undefined ? undefined : Object.values(row)[0];
    },
    close: () => db.close(),
  });
}

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { enrichFailureNoise } from '../../noise/enrich.js';
import type { Attachment, NewFailure, UnattachedCheck } from '../../storage/failures.js';
import { DATA_DIR, openStore, type Store } from '../../storage/store.js';
import { listCommitFiles, readBlobIds, resolveHead } from './head-blobs.js';

interface CheckPayload {
  readonly ai_event_ids?: unknown;
  readonly outcome?: unknown;
  readonly whitespace_only?: unknown;
  readonly staged_blob?: unknown;
  readonly staged_content?: unknown;
  readonly self_fix?: unknown;
}

function groupByFile(checks: readonly UnattachedCheck[]): ReadonlyMap<string, readonly UnattachedCheck[]> {
  const groups = new Map<string, UnattachedCheck[]>();
  for (const check of checks) groups.set(check.filePath, [...(groups.get(check.filePath) ?? []), check]);
  return groups;
}

function editIds(payload: CheckPayload): readonly number[] {
  return Array.isArray(payload.ai_event_ids) ? payload.ai_event_ids.filter((id): id is number => Number.isInteger(id)) : [];
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

// The developer changed the AI's latest version before committing.
function manualFix(store: Store, check: UnattachedCheck, payload: CheckPayload, ids: readonly number[], finalContent: string): NewFailure | null {
  if (payload.outcome !== 'modified' || payload.whitespace_only === true || ids.length === 0) return null;
  const latestEdit = Math.max(...ids);
  const aiContent = store.getSnapshot(latestEdit);
  if (aiContent === null) return null;
  return { filePath: check.filePath, aiEventId: latestEdit, promptEventId: store.findPromptBefore(Math.min(...ids)), aiContent, finalContent };
}

// The developer answered an AI edit with a prompt and the AI changed or dropped lines it had written.
function aiSelfFix(store: Store, check: UnattachedCheck, payload: CheckPayload, _ids: readonly number[], finalContent: string): NewFailure | null {
  const fix = payload.self_fix;
  if (!isRecord(fix) || !Number.isInteger(fix.edit_id) || !Number.isInteger(fix.feedback_event_id)) return null;
  const editId = fix.edit_id as number;
  const feedbackId = fix.feedback_event_id as number;
  // The AI only adding code is a new request, not a correction.
  if (typeof fix.lines_removed !== 'number' || fix.lines_removed <= 0 || fix.whitespace_only !== false) return null;
  // Re-checked here: the payload alone is not trusted to point at the right events.
  if (!store.isFeedbackFor(editId, feedbackId, check.filePath)) return null;
  const aiContent = store.getSnapshot(editId);
  if (aiContent === null) return null;
  return {
    filePath: check.filePath,
    aiEventId: editId,
    promptEventId: store.findPromptBefore(editId),
    aiContent,
    finalContent,
    source: 'ai-self-fix',
    feedbackEventId: feedbackId,
  };
}

// Judges a check whose staged blob is the one now in HEAD.
function judge(store: Store, check: UnattachedCheck): Attachment {
  const payload = (store.getEventPayload(check.id) ?? {}) as CheckPayload;
  if (typeof payload.staged_content !== 'string') return { checkId: check.id, outcome: 'not-a-failure' };
  const ids = editIds(payload);
  const stats = store.listNoiseStats();
  const failures = [manualFix, aiSelfFix]
    .map((find) => find(store, check, payload, ids, payload.staged_content as string))
    .filter((failure): failure is NewFailure => failure !== null)
    .map((failure) => enrichFailureNoise(failure, stats));
  return failures.length === 0 ? { checkId: check.id, outcome: 'not-a-failure' } : { checkId: check.id, outcome: 'failure', failures };
}

interface FileState {
  readonly headBlob: string | undefined;
  // HEAD changed this file, so a check of another version of it can never be committed now.
  readonly touched: boolean;
}

// What the pending checks of one file become. Checks left out stay pending for a later commit.
function attachFile(store: Store, checks: readonly UnattachedCheck[], file: FileState): Attachment[] {
  // Skipped checks carry no blob: they can never match, so close them now.
  const closed: Attachment[] = checks
    .filter((check) => check.stagedBlob === null)
    .map((check) => ({ checkId: check.id, outcome: 'not-a-failure' }));
  const comparable = checks.filter((check) => check.stagedBlob !== null);
  const lastMatch = comparable.findLastIndex((check) => check.stagedBlob === file.headBlob);
  if (lastMatch === -1) {
    if (!file.touched) return closed;
    return [...closed, ...comparable.map((check) => ({ checkId: check.id, outcome: 'superseded' as const }))];
  }
  // Judge every check whose staged blob is HEAD (one per agent is common). Supersede older
  // non-matching checks; leave anything after the last match for a later commit.
  return [
    ...closed,
    ...comparable.slice(0, lastMatch + 1).map((check) =>
      check.stagedBlob === file.headBlob
        ? judge(store, check)
        : { checkId: check.id, outcome: 'superseded' as const },
    ),
  ];
}

// Turns the commit-checks matching what HEAD now holds into failure records. Returns the
// number of failures created; stops at `deadline`.
export async function attachCommit(root: string, deadline: number): Promise<number> {
  // No .nightowl/ means init never ran here: create nothing.
  if (!existsSync(join(root, DATA_DIR)) || Date.now() >= deadline) return 0;
  const remaining = () => Math.max(1, deadline - Date.now());

  const store = await openStore({ cwd: root, timeoutMs: remaining() });
  try {
    const pending = groupByFile(store.listUnattachedChecks());
    if (pending.size === 0) return 0;
    const head = await resolveHead(root, remaining());
    const blobs = await readBlobIds(root, head, [...pending.keys()], remaining());
    const touched = await listCommitFiles(root, head, remaining());

    const attachments: Attachment[] = [];
    for (const [filePath, checks] of pending) {
      if (Date.now() >= deadline) return 0;
      // git cannot look such a path up, so its checks could never be closed otherwise.
      const unreadable = filePath.includes('\n');
      attachments.push(...attachFile(store, checks, { headBlob: blobs.get(filePath), touched: unreadable || touched.has(filePath) }));
    }
    if (attachments.length === 0 || Date.now() >= deadline) return 0;
    store.setBusyTimeout(remaining());
    return store.attachChecks(head, attachments);
  } finally {
    store.close();
  }
}

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Attachment, UnattachedCheck } from '../../storage/failures.js';
import { DATA_DIR, openStore, type Store } from '../../storage/store.js';
import { listCommitFiles, readBlobIds, resolveHead } from './head-blobs.js';

interface CheckPayload {
  readonly ai_event_ids?: unknown;
  readonly outcome?: unknown;
  readonly whitespace_only?: unknown;
  readonly staged_blob?: unknown;
  readonly staged_content?: unknown;
}

function groupByFile(checks: readonly UnattachedCheck[]): ReadonlyMap<string, readonly UnattachedCheck[]> {
  const groups = new Map<string, UnattachedCheck[]>();
  for (const check of checks) groups.set(check.filePath, [...(groups.get(check.filePath) ?? []), check]);
  return groups;
}

function editIds(payload: CheckPayload): readonly number[] {
  return Array.isArray(payload.ai_event_ids) ? payload.ai_event_ids.filter((id): id is number => Number.isInteger(id)) : [];
}

// Judges a check whose staged blob is the one now in HEAD.
function judge(store: Store, check: UnattachedCheck): Attachment {
  const payload = (store.getEventPayload(check.id) ?? {}) as CheckPayload;
  const ids = editIds(payload);
  const latestEdit = ids.length > 0 ? Math.max(...ids) : undefined;
  const aiContent = latestEdit === undefined ? null : store.getSnapshot(latestEdit);
  const isFailure =
    payload.outcome === 'modified' &&
    payload.whitespace_only !== true &&
    typeof payload.staged_content === 'string' &&
    aiContent !== null &&
    latestEdit !== undefined;
  if (!isFailure) return { checkId: check.id, outcome: 'not-a-failure' };

  return {
    checkId: check.id,
    outcome: 'failure',
    failure: {
      filePath: check.filePath,
      aiEventId: latestEdit,
      promptEventId: store.findPromptBefore(Math.min(...ids)),
      aiContent,
      finalContent: payload.staged_content as string,
    },
  };
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
  const match = comparable.findLastIndex((check) => check.stagedBlob === file.headBlob);
  if (match === -1) {
    if (!file.touched) return closed;
    return [...closed, ...comparable.map((check) => ({ checkId: check.id, outcome: 'superseded' as const }))];
  }
  // Only checks older than the committed one are replaced; newer ones may belong to the next commit.
  return [
    ...closed,
    ...comparable.slice(0, match).map((check) => ({ checkId: check.id, outcome: 'superseded' as const })),
    judge(store, comparable[match] as UnattachedCheck),
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

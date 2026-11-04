import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Attachment, UnattachedCheck } from '../../storage/failures.js';
import { DATA_DIR, openStore, type Store } from '../../storage/store.js';
import { readBlobIds, resolveHead } from './head-blobs.js';

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

// Decides what the latest check of a file becomes, or null to leave it for a later commit.
function attachLatest(store: Store, check: UnattachedCheck, headBlob: string | undefined): Attachment | null {
  const payload = (store.getEventPayload(check.id) ?? {}) as CheckPayload;
  // Skipped checks carry no blob: they can never match, so close them now.
  if (typeof payload.staged_blob !== 'string') return { checkId: check.id, outcome: 'not-a-failure' };
  if (payload.staged_blob !== headBlob) return null;

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

// Turns the commit-checks matching what HEAD now holds into failure records. Older checks of
// the same file are superseded. Returns the number of failures created; stops at `deadline`.
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

    const attachments: Attachment[] = [];
    for (const [filePath, checks] of pending) {
      if (Date.now() >= deadline) break;
      const latest = checks[checks.length - 1] as UnattachedCheck;
      for (const older of checks.slice(0, -1)) attachments.push({ checkId: older.id, outcome: 'superseded' });
      const attachment = attachLatest(store, latest, blobs.get(filePath));
      if (attachment !== null) attachments.push(attachment);
    }
    return attachments.length === 0 ? 0 : store.attachChecks(head, attachments);
  } finally {
    store.close();
  }
}

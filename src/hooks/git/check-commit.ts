import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { NewEvent, PendingEdit } from '../../storage/events.js';
import { DATA_DIR, openStore, type Store } from '../../storage/store.js';
import { compareContent } from './compare.js';
import { listStagedFiles, readStagedFiles, type StagedFile } from './staged.js';

export const MAX_STAGED_BYTES = 512 * 1024;

function groupByFile(edits: readonly PendingEdit[]): ReadonlyMap<string, readonly PendingEdit[]> {
  const groups = new Map<string, PendingEdit[]>();
  for (const edit of edits) groups.set(edit.filePath, [...(groups.get(edit.filePath) ?? []), edit]);
  return groups;
}

function commitCheck(store: Store, filePath: string, edits: readonly PendingEdit[], staged: StagedFile): NewEvent {
  const latest = edits[edits.length - 1] as PendingEdit;
  const base = { source: 'git', kind: 'commit-check', sessionId: latest.sessionId, filePath } as const;
  const aiEventIds = edits.map((edit) => edit.id);
  const snapshot = store.getSnapshot(latest.id);
  // Never fall back to an older snapshot: the staged file would be compared with stale content.
  if (snapshot === null) {
    return { ...base, payload: { ai_event_ids: aiEventIds, outcome: 'skipped', skipped_reason: 'no_snapshot' } };
  }
  const tooLarge = Buffer.byteLength(staged.content) > MAX_STAGED_BYTES;
  return {
    ...base,
    payload: {
      ai_event_ids: aiEventIds,
      ...compareContent(snapshot, staged.content),
      staged_blob: staged.blob,
      staged_content: tooLarge ? null : staged.content,
      staged_skipped: tooLarge ? 'too_large' : null,
    },
  };
}

// Compares every staged file the AI edited with the AI's latest snapshot and stores one
// commit-check per file. Stops at `deadline`; files already checked stay recorded.
export async function checkStagedChanges(root: string, deadline: number): Promise<number> {
  // No .nightowl/ means init never ran here: create nothing.
  if (!existsSync(join(root, DATA_DIR)) || Date.now() >= deadline) return 0;
  const remaining = () => Math.max(1, deadline - Date.now());

  const store = await openStore({ cwd: root, timeoutMs: remaining() });
  try {
    const pending = groupByFile(store.listUncheckedEdits(await listStagedFiles(root, remaining())));
    if (pending.size === 0) return 0;
    const staged = await readStagedFiles(root, [...pending.keys()], remaining());

    let written = 0;
    for (const [filePath, edits] of pending) {
      if (Date.now() >= deadline) break;
      const file = staged.get(filePath);
      if (file === undefined) continue;
      store.recordCommitCheck(commitCheck(store, filePath, edits, file), edits.map((edit) => edit.id));
      written += 1;
    }
    return written;
  } finally {
    store.close();
  }
}

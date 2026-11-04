import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { StoredEvent } from '../../storage/events.js';
import { DATA_DIR, openStore, type Store } from '../../storage/store.js';
import { compareContent } from './compare.js';
import { listStagedFiles, readStagedFiles, type StagedFile } from './staged.js';

export const MAX_STAGED_BYTES = 512 * 1024;

function groupByFile(edits: readonly StoredEvent[]): ReadonlyMap<string, readonly StoredEvent[]> {
  const groups = new Map<string, StoredEvent[]>();
  for (const edit of edits) {
    if (edit.filePath === null) continue;
    groups.set(edit.filePath, [...(groups.get(edit.filePath) ?? []), edit]);
  }
  return groups;
}

function recordCheck(store: Store, filePath: string, edits: readonly StoredEvent[], staged: StagedFile): void {
  const latest = edits[edits.length - 1] as StoredEvent;
  const snapshot = (latest.payload as { snapshot: string }).snapshot;
  const tooLarge = Buffer.byteLength(staged.content) > MAX_STAGED_BYTES;
  store.insertEvent({
    source: 'git',
    kind: 'commit-check',
    sessionId: latest.sessionId,
    filePath,
    payload: {
      ai_event_ids: edits.map((edit) => edit.id),
      ...compareContent(snapshot, staged.content),
      staged_blob: staged.blob,
      staged_content: tooLarge ? null : staged.content,
      staged_skipped: tooLarge ? 'too_large' : null,
    },
  });
}

// Compares every staged file the AI edited with the AI's latest snapshot and stores one
// commit-check per file. Stops at `deadline`; files already checked stay recorded.
export async function checkStagedChanges(root: string, deadline: number): Promise<number> {
  // No .nightowl/ means init never ran here: create nothing.
  if (!existsSync(join(root, DATA_DIR)) || Date.now() >= deadline) return 0;
  const remaining = () => Math.max(1, deadline - Date.now());

  const store = await openStore({ cwd: root });
  try {
    const pending = groupByFile(store.listUncheckedEdits(await listStagedFiles(root, remaining())));
    if (pending.size === 0) return 0;
    const staged = await readStagedFiles(root, [...pending.keys()], remaining());

    let written = 0;
    for (const [filePath, edits] of pending) {
      if (Date.now() >= deadline) break;
      const file = staged.get(filePath);
      if (file === undefined) continue;
      recordCheck(store, filePath, edits, file);
      written += 1;
    }
    return written;
  } finally {
    store.close();
  }
}

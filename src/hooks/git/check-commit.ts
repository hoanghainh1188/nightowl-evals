import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { NewEvent, PendingEdit } from '../../storage/events.js';
import { DATA_DIR, openStore, type Store } from '../../storage/store.js';
import { containsInlineSecret } from '../claude-code/sensitive.js';
import { compareContent } from './compare.js';
import { listStagedFiles, readStagedFiles, type StagedFile } from './staged.js';

export const MAX_STAGED_BYTES = 512 * 1024;

function groupByFile(edits: readonly PendingEdit[]): ReadonlyMap<string, readonly PendingEdit[]> {
  const groups = new Map<string, PendingEdit[]>();
  for (const edit of edits) groups.set(edit.filePath, [...(groups.get(edit.filePath) ?? []), edit]);
  return groups;
}

// Consecutive AI edits of one session, oldest pair first. Edits of other sessions in between
// do not break a pair: the developer answers the AI of their own session.
function sessionPairs(edits: readonly PendingEdit[]): ReadonlyArray<readonly [PendingEdit, PendingEdit]> {
  const last = new Map<string, PendingEdit>();
  const pairs: Array<readonly [PendingEdit, PendingEdit]> = [];
  for (const edit of edits) {
    if (edit.sessionId === null) continue;
    const previous = last.get(edit.sessionId);
    if (previous !== undefined) pairs.push([previous, edit]);
    last.set(edit.sessionId, edit);
  }
  return pairs.sort((a, b) => a[0].id - b[0].id);
}

// The first edit of this file that the developer answered with a prompt, after which the AI
// itself dropped or changed lines of it. `final` is the AI's latest version of the file.
function findSelfFix(store: Store, filePath: string, final: string, staged: string): Record<string, unknown> | null {
  for (const [edit, next] of sessionPairs(store.listOpenEdits(filePath))) {
    const feedback = store.findPromptBetween(edit.id, next.id);
    if (feedback === null) continue;
    const snapshot = store.getSnapshot(edit.id);
    // The developer committed exactly what they pushed back on: nothing was fixed.
    if (snapshot === null || snapshot === staged) continue;
    // Compared with the AI's own final version, so lines only the developer removed do not count.
    const { outcome, ...byAi } = compareContent(snapshot, final);
    if (outcome === 'unchanged' || byAi.lines_removed === 0 || byAi.whitespace_only) continue;
    return { edit_id: edit.id, feedback_event_id: feedback, ...byAi };
  }
  return null;
}

// Never lets the extra lookup cost the check itself.
function safeSelfFix(store: Store, filePath: string, final: string, staged: string): Record<string, unknown> | null {
  try {
    return findSelfFix(store, filePath, final, staged);
  } catch {
    return null;
  }
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
  const hasSecret = containsInlineSecret(staged.content);
  return {
    ...base,
    payload: {
      ai_event_ids: aiEventIds,
      ...compareContent(snapshot, staged.content),
      staged_blob: staged.blob,
      staged_content: tooLarge || hasSecret ? null : staged.content,
      staged_skipped: tooLarge ? 'too_large' : hasSecret ? 'contains_secret' : null,
      self_fix: tooLarge || hasSecret ? null : safeSelfFix(store, filePath, snapshot, staged.content),
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

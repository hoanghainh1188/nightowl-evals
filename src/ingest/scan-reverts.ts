import { GitError, runGit } from '../hooks/git/run-git.js';
import type { Store } from '../storage/store.js';
import { parseRevertMessage, revertDedupeKey } from './revert.js';

export interface RevertCommit {
  readonly revertCommitSha: string;
  readonly revertedCommitSha: string;
}

export interface IngestRevertResult {
  readonly inserted: number;
  readonly skipped: number;
  readonly unmatched: number;
  readonly scanned: number;
}

export type RunGit = typeof runGit;

/**
 * Scans local git history for standard revert commits since `since` (YYYY-MM-DD or git-compatible).
 * Returns [] on git errors (fail-open for callers that are not hard-failing on config).
 */
export async function listRevertCommits(
  cwd: string,
  since: string,
  run: RunGit = runGit,
): Promise<readonly RevertCommit[]> {
  let stdout: Buffer;
  try {
    stdout = await run(['log', `--since=${since}`, '--format=%H%x00%B%x00'], { cwd });
  } catch (error) {
    if (error instanceof GitError) return [];
    throw error;
  }
  const text = stdout.toString('utf8');
  if (text.length === 0) return [];
  // --format=%H%x00%B%x00 yields alternating sha / message fields.
  const parts = text.split('\0');
  const out: RevertCommit[] = [];
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const sha = parts[i]!.replace(/^\n+/, '').trim().toLowerCase();
    const body = parts[i + 1] ?? '';
    if (!/^[0-9a-f]{40}$/.test(sha)) continue;
    const reverted = parseRevertMessage(body);
    if (reverted === null) continue;
    out.push(Object.freeze({ revertCommitSha: sha, revertedCommitSha: reverted }));
  }
  return Object.freeze(out);
}

export interface RevertIngestStore {
  readonly insertEvent: Store['insertEvent'];
  readonly countEventsByKind: Store['countEventsByKind'];
  readonly mapFailureIdsByCommitSha: Store['mapFailureIdsByCommitSha'];
}

/** Writes revert events only when a failure.commit_sha matches; idempotent via dedupe_key. */
export function ingestRevertCommits(store: RevertIngestStore, reverts: readonly RevertCommit[]): IngestRevertResult {
  const bySha = store.mapFailureIdsByCommitSha();
  const before = store.countEventsByKind(['revert'], null)['revert'] ?? 0;
  let unmatched = 0;
  let candidates = 0;
  for (const item of reverts) {
    const failureIds = bySha.get(item.revertedCommitSha) ?? [];
    if (failureIds.length === 0) {
      unmatched += 1;
      continue;
    }
    candidates += 1;
    store.insertEvent({
      source: 'git',
      kind: 'revert',
      dedupeKey: revertDedupeKey(item.revertedCommitSha, item.revertCommitSha),
      payload: {
        reverted_commit_sha: item.revertedCommitSha,
        revert_commit_sha: item.revertCommitSha,
        failure_ids: [...failureIds],
      },
    });
  }
  const after = store.countEventsByKind(['revert'], null)['revert'] ?? 0;
  const inserted = after - before;
  return {
    inserted,
    skipped: Math.max(0, candidates - inserted),
    unmatched,
    scanned: reverts.length,
  };
}

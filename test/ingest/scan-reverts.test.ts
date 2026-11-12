import { describe, expect, it } from 'vitest';
import { GitError } from '../../src/hooks/git/run-git.js';
import { ingestRevertCommits, listRevertCommits } from '../../src/ingest/scan-reverts.js';
import { revertDedupeKey } from '../../src/ingest/revert.js';

const A = 'abcdef0123456789abcdef0123456789abcdef01';
const B = 'fedcba9876543210fedcba9876543210fedcba98';

describe('listRevertCommits', () => {
  it('parses null-separated git log output', async () => {
    const run = async () =>
      Buffer.from(`${B}\0Revert "x"\n\nThis reverts commit ${A}.\n\0`, 'utf8');
    const commits = await listRevertCommits('/tmp', '2026-01-01', run as never);
    expect(commits).toEqual([{ revertCommitSha: B, revertedCommitSha: A }]);
  });

  it('returns [] when git fails', async () => {
    const run = async () => {
      throw new GitError(['log'], 128);
    };
    await expect(listRevertCommits('/tmp', '2026-01-01', run as never)).resolves.toEqual([]);
  });
});

describe('ingestRevertCommits', () => {
  it('writes only matching failures and is idempotent via dedupe', () => {
    const events: Array<{ dedupeKey?: string | null; payload: unknown }> = [];
    const store = {
      mapFailureIdsByCommitSha: () => new Map([[A, [7, 8]]]),
      countEventsByKind: (kinds: readonly string[]) => {
        const n = events.filter(() => kinds.includes('revert')).length;
        return { revert: n };
      },
      insertEvent: (event: { dedupeKey?: string | null; payload: unknown }) => {
        if (event.dedupeKey && events.some((e) => e.dedupeKey === event.dedupeKey)) {
          return event;
        }
        events.push(event);
        return event;
      },
    };

    const first = ingestRevertCommits(store as never, [
      { revertCommitSha: B, revertedCommitSha: A },
      { revertCommitSha: B, revertedCommitSha: '1111111111111111111111111111111111111111' },
    ]);
    expect(first).toEqual({ inserted: 1, skipped: 0, unmatched: 1, scanned: 2 });
    expect(events[0]).toMatchObject({
      dedupeKey: revertDedupeKey(A, B),
      payload: { failure_ids: [7, 8], reverted_commit_sha: A, revert_commit_sha: B },
    });

    const second = ingestRevertCommits(store as never, [{ revertCommitSha: B, revertedCommitSha: A }]);
    expect(second).toEqual({ inserted: 0, skipped: 1, unmatched: 0, scanned: 1 });
  });
});

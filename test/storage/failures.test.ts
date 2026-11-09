import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { NewFailure } from '../../src/storage/failures.js';
import { openStore, type Store } from '../../src/storage/store.js';
import { createFakeRepo, type TempDir } from '../helpers/temp-repo.js';

describe('failure records storage', () => {
  let repo: TempDir;
  let store: Store;

  beforeEach(async () => {
    repo = await createFakeRepo();
    store = await openStore({ cwd: repo.path });
  });
  afterEach(async () => {
    store.close();
    await repo.cleanup();
  });

  const event = (kind: string, sessionId: string | null, filePath: string | null = null) =>
    store.insertEvent({
      source: kind === 'commit-check' ? 'git' : 'agent-hook',
      kind,
      sessionId,
      filePath,
      agent: kind === 'commit-check' ? null : 'claude-code',
      payload: { n: 1 },
    });

  const failure = (aiEventId: number, overrides: Partial<NewFailure> = {}): NewFailure => ({
    filePath: 'a.ts',
    aiEventId,
    promptEventId: null,
    aiContent: 'ai',
    finalContent: 'dev',
    ...overrides,
  });

  it('lists commit-checks not attached yet, oldest first, without payloads', () => {
    const c1 = event('commit-check', null, 'a.ts');
    event('edit', 's1', 'a.ts');
    const c2 = event('commit-check', null, 'b.ts');
    expect(store.listUnattachedChecks()).toEqual([
      { id: c1.id, filePath: 'a.ts', stagedBlob: null },
      { id: c2.id, filePath: 'b.ts', stagedBlob: null },
    ]);
    expect(store.getEventPayload(c1.id)).toEqual({ n: 1 });
    expect(store.getEventPayload(9999)).toBeNull();
  });

  it('stores a failure with its checks in one transaction and never twice', () => {
    const edit = event('edit', 's1', 'a.ts');
    const older = event('commit-check', null, 'a.ts');
    const latest = event('commit-check', null, 'a.ts');
    const attachments = [
      { checkId: older.id, outcome: 'superseded' as const },
      { checkId: latest.id, outcome: 'failure' as const, failures: [failure(edit.id)] },
    ];
    expect(store.attachChecks('abc123', attachments)).toBe(1);
    expect(store.attachChecks('abc123', attachments)).toBe(0);
    expect(store.listUnattachedChecks()).toEqual([]);
    expect(store.countFailures()).toEqual({ total: 1, byStatus: { flagged: 1 } });
  });

  it('stores two failures for one check, with their source and feedback', async () => {
    const prompt = event('prompt', 's1');
    const first = event('edit', 's1', 'a.ts');
    const feedback = event('prompt', 's1');
    const second = event('edit', 's1', 'a.ts');
    const check = event('commit-check', null, 'a.ts');
    expect(
      store.attachChecks('abc', [
        {
          checkId: check.id,
          outcome: 'failure',
          failures: [
            failure(second.id, { promptEventId: prompt.id }),
            failure(first.id, { promptEventId: prompt.id, source: 'ai-self-fix', feedbackEventId: feedback.id }),
          ],
        },
      ]),
    ).toBe(2);
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(`${repo.path}/.nightowl/nightowl.db`, { readOnly: true });
    try {
      const rows = db.prepare('SELECT id, ai_event_id, source, feedback_event_id FROM failures ORDER BY id').all();
      expect(rows).toEqual([
        { id: expect.any(Number), ai_event_id: second.id, source: 'manual-fix', feedback_event_id: null },
        { id: expect.any(Number), ai_event_id: first.id, source: 'ai-self-fix', feedback_event_id: feedback.id },
      ]);
      const attached = db.prepare('SELECT failure_id FROM checks_attached').get() as { failure_id: number };
      expect(attached.failure_id).toBe((rows[0] as { id: number }).id);
    } finally {
      db.close();
    }
  });

  it('lists failures to classify with their feedback prompt', () => {
    const prompt = store.insertEvent({ source: 'agent-hook', kind: 'prompt', sessionId: 's1', payload: { prompt: 'write it' } });
    const edit = event('edit', 's1', 'a.ts');
    const feedback = store.insertEvent({ source: 'agent-hook', kind: 'prompt', sessionId: 's1', payload: { prompt: 'wrong' } });
    const check = event('commit-check', null, 'a.ts');
    store.attachChecks('abc', [
      {
        checkId: check.id,
        outcome: 'failure',
        failures: [failure(edit.id, { promptEventId: prompt.id, source: 'ai-self-fix', feedbackEventId: feedback.id })],
      },
    ]);
    expect(store.listFailuresToClassify(10, false)).toEqual([
      expect.objectContaining({ userPrompt: 'write it', feedback: 'wrong' }),
    ]);
  });

  describe('isFeedbackFor', () => {
    it('accepts a prompt of the session between the edit and a later edit of the same file', () => {
      const edit = event('edit', 's1', 'a.ts');
      const feedback = event('prompt', 's1');
      event('edit', 's1', 'a.ts');
      expect(store.isFeedbackFor(edit.id, feedback.id, 'a.ts')).toBe(true);
    });

    it.each([
      ['a prompt of another session', () => {
        const edit = event('edit', 's1', 'a.ts');
        const feedback = event('prompt', 's2');
        event('edit', 's1', 'a.ts');
        return [edit.id, feedback.id] as const;
      }],
      ['a prompt with no later edit', () => {
        const edit = event('edit', 's1', 'a.ts');
        const feedback = event('prompt', 's1');
        return [edit.id, feedback.id] as const;
      }],
      ['an edit of another file', () => {
        const edit = event('edit', 's1', 'b.ts');
        const feedback = event('prompt', 's1');
        event('edit', 's1', 'b.ts');
        return [edit.id, feedback.id] as const;
      }],
      ['an event that is not a prompt', () => {
        const edit = event('edit', 's1', 'a.ts');
        const other = event('edit', 's1', 'a.ts');
        event('edit', 's1', 'a.ts');
        return [edit.id, other.id] as const;
      }],
    ])('rejects %s', (_label, setUp) => {
      const [edit, feedback] = setUp();
      expect(store.isFeedbackFor(edit, feedback, 'a.ts')).toBe(false);
    });
  });

  describe('findPromptBetween', () => {
    it('finds the first prompt of the same session between two edits', () => {
      const first = event('edit', 's1', 'a.ts');
      event('prompt', 's2');
      const feedback = event('prompt', 's1');
      event('prompt', 's1');
      const second = event('edit', 's1', 'a.ts');
      expect(store.findPromptBetween(first.id, second.id)).toBe(feedback.id);
    });

    it('ignores prompts of another session', () => {
      const first = event('edit', 's1', 'a.ts');
      event('prompt', 's2');
      const second = event('edit', 's1', 'a.ts');
      expect(store.findPromptBetween(first.id, second.id)).toBeNull();
    });

    it('needs both edits in the same session', () => {
      const first = event('edit', 's1', 'a.ts');
      event('prompt', 's2');
      const second = event('edit', 's2', 'a.ts');
      expect(store.findPromptBetween(first.id, second.id)).toBeNull();
    });

    it('finds nothing for edits without a session', () => {
      const first = event('edit', null, 'a.ts');
      event('prompt', null);
      const second = event('edit', null, 'a.ts');
      expect(store.findPromptBetween(first.id, second.id)).toBeNull();
    });
  });

  it('rolls back the failure when attaching fails', () => {
    const edit = event('edit', 's1', 'a.ts');
    const check = event('commit-check', null, 'a.ts');
    expect(() =>
      store.attachChecks('abc', [
        { checkId: check.id, outcome: 'failure', failures: [failure(edit.id)] },
        // Unknown event id: violates the foreign key.
        { checkId: 9999, outcome: 'not-a-failure' },
      ]),
    ).toThrow();
    expect(store.countFailures().total).toBe(0);
    expect(store.listUnattachedChecks()).toHaveLength(1);
  });

  it('finds the latest prompt of the same session before an edit', () => {
    const p1 = event('prompt', 's1');
    event('prompt', 's2');
    const p3 = event('prompt', 's1');
    const edit = event('edit', 's1', 'a.ts');
    event('prompt', 's1');
    expect(store.findPromptBefore(edit.id)).toBe(p3.id);
    expect(p1.id).toBeLessThan(p3.id);
  });

  it('finds no prompt for another session, a missing session or no prompt', () => {
    event('prompt', 's2');
    expect(store.findPromptBefore(event('edit', 's1', 'a.ts').id)).toBeNull();
    expect(store.findPromptBefore(event('edit', null, 'a.ts').id)).toBeNull();
    expect(store.findPromptBefore(9999)).toBeNull();
  });

  it('reads the staged blob of each check', () => {
    const check = store.insertEvent({ source: 'git', kind: 'commit-check', filePath: 'a.ts', payload: { staged_blob: 'abc' } });
    expect(store.listUnattachedChecks()).toEqual([{ id: check.id, filePath: 'a.ts', stagedBlob: 'abc' }]);
  });

  it('counts failures by status', () => {
    expect(store.countFailures()).toEqual({ total: 0, byStatus: {} });
  });
});

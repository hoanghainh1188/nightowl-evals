import { readdir } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { attachCommit } from '../../../src/hooks/git/attach-commit.js';
import { checkStagedChanges } from '../../../src/hooks/git/check-commit.js';
import { openStore } from '../../../src/storage/store.js';
import { createGitRepo, git } from '../../helpers/git-repo.js';
import { type TempDir, writeFiles } from '../../helpers/temp-repo.js';

interface FailureRow {
  file_path: string;
  ai_event_id: number;
  prompt_event_id: number | null;
  ai_content: string;
  final_content: string;
  commit_sha: string;
  status: string;
  category: string | null;
  source: string;
  feedback_event_id: number | null;
}

describe('attachCommit', () => {
  let repo: TempDir;
  const far = () => Date.now() + 10_000;

  beforeEach(async () => {
    repo = await createGitRepo();
  });
  afterEach(() => repo.cleanup());

  async function insert(kind: 'edit' | 'prompt', sessionId: string, filePath: string | null, payload: unknown): Promise<number> {
    const store = await openStore({ cwd: repo.path });
    try {
      return store.insertEvent({ source: 'agent-hook', kind, sessionId, filePath, payload }).id;
    } finally {
      store.close();
    }
  }

  const prompt = (sessionId: string, text: string) => insert('prompt', sessionId, null, { prompt: text });

  async function aiWrote(file: string, content: string, sessionId = 's1'): Promise<number> {
    await writeFiles(repo.path, { [file]: content });
    return insert('edit', sessionId, file, { tool: 'Write', snapshot: content, snapshot_skipped: null });
  }

  // Runs what the pre-commit and post-commit hooks run around a real commit.
  async function commit(files: Readonly<Record<string, string>> = {}): Promise<string> {
    await writeFiles(repo.path, files);
    git(repo.path, ['add', '-A']);
    await checkStagedChanges(repo.path, far());
    git(repo.path, ['commit', '-q', '--allow-empty', '-m', 'change']);
    await attachCommit(repo.path, far());
    return git(repo.path, ['rev-parse', 'HEAD']).trim();
  }

  function failures(): FailureRow[] {
    const db = new DatabaseSync(join(repo.path, '.nightowl/nightowl.db'));
    try {
      return db.prepare('SELECT * FROM failures ORDER BY id').all() as unknown as FailureRow[];
    } finally {
      db.close();
    }
  }

  function attachedOutcomes(): string[] {
    const db = new DatabaseSync(join(repo.path, '.nightowl/nightowl.db'));
    try {
      return (db.prepare('SELECT outcome FROM checks_attached ORDER BY check_id').all() as Array<{ outcome: string }>).map(
        (row) => row.outcome,
      );
    } finally {
      db.close();
    }
  }

  it('records a failure when the developer changed the AI code and committed it', async () => {
    const edit = await aiWrote('src/a.ts', 'export const a = 1;\n');
    const sha = await commit({ 'src/a.ts': 'export const a = 2;\n' });
    expect(failures()).toEqual([
      expect.objectContaining({
        file_path: 'src/a.ts',
        ai_event_id: edit,
        ai_content: 'export const a = 1;\n',
        final_content: 'export const a = 2;\n',
        commit_sha: sha,
        status: 'flagged',
        category: null,
        noise_score: 0,
        noise_reasons: '',
      }),
    ]);
  });

  it('auto-dismisses comment-only changes as noise without counting toward report total', async () => {
    const edit = await aiWrote('src/a.ts', 'export const a = 1;\n');
    const sha = await commit({ 'src/a.ts': 'export const a = 1; // tweak\n' });
    expect(failures()).toEqual([
      expect.objectContaining({
        file_path: 'src/a.ts',
        ai_event_id: edit,
        commit_sha: sha,
        status: 'dismissed',
        noise_score: 0.9,
        noise_reasons: 'comment-only,auto-noise',
      }),
    ]);
    const store = await openStore({ cwd: repo.path });
    try {
      expect(store.countFailures().byStatus).toEqual({ dismissed: 1 });
      expect(store.countFailuresForReport(null).reduce((n, row) => n + (row.status === 'dismissed' ? 0 : row.count), 0)).toBe(0);
      expect(store.countAutoNoiseFailures(null)).toBe(1);
    } finally {
      store.close();
    }
  });

  it('records nothing when the AI code is committed as is', async () => {
    await aiWrote('src/a.ts', 'x\n');
    await commit();
    expect(failures()).toEqual([]);
    expect(attachedOutcomes()).toEqual(['not-a-failure']);
  });

  it('records nothing for whitespace-only changes', async () => {
    await aiWrote('src/a.ts', 'if (a) {\n  b();\n}\n');
    await commit({ 'src/a.ts': 'if (a) {\n    b();\n}\n' });
    expect(failures()).toEqual([]);
  });

  it('closes skipped checks, which have no blob to match', async () => {
    await aiWrote('src/a.ts', 'x\n');
    await insert('edit', 's1', 'src/a.ts', { tool: 'Write', snapshot: null, snapshot_skipped: 'too_large' });
    await commit({ 'src/a.ts': 'y\n' });
    expect(failures()).toEqual([]);
    expect(attachedOutcomes()).toEqual(['not-a-failure']);
  });

  it('leaves a check whose blob is not in HEAD for a later commit', async () => {
    await aiWrote('src/a.ts', 'ai\n');
    await writeFiles(repo.path, { 'src/a.ts': 'dev\n' });
    git(repo.path, ['add', '-A']);
    await checkStagedChanges(repo.path, far());
    // The commit is aborted; another commit without that file runs post-commit.
    git(repo.path, ['reset', '-q']);
    await writeFiles(repo.path, { 'other.ts': 'o\n' });
    git(repo.path, ['add', 'other.ts']);
    git(repo.path, ['commit', '-q', '-m', 'other']);
    await attachCommit(repo.path, far());
    expect(failures()).toEqual([]);
    expect(attachedOutcomes()).toEqual([]);

    // The developer later commits the same content.
    const sha = await commit();
    expect(failures()).toEqual([expect.objectContaining({ file_path: 'src/a.ts', final_content: 'dev\n', commit_sha: sha })]);
  });

  it('marks older checks of a file as superseded and only judges the latest', async () => {
    await aiWrote('src/a.ts', 'ai1\n');
    await writeFiles(repo.path, { 'src/a.ts': 'dev1\n' });
    git(repo.path, ['add', '-A']);
    await checkStagedChanges(repo.path, far());
    git(repo.path, ['reset', '-q']);
    await aiWrote('src/a.ts', 'ai2\n');
    await commit();
    expect(attachedOutcomes()).toEqual(['superseded', 'not-a-failure']);
    expect(failures()).toEqual([]);
  });

  it('judges the check that matches HEAD even when a newer one is pending', async () => {
    await aiWrote('src/a.ts', 'ai\n');
    await writeFiles(repo.path, { 'src/a.ts': 'dev\n' });
    git(repo.path, ['add', '-A']);
    await checkStagedChanges(repo.path, far());
    // post-commit did not run for this commit (timeout, hook skipped).
    git(repo.path, ['commit', '-q', '-m', 'first']);
    await aiWrote('src/a.ts', 'ai again\n');
    await writeFiles(repo.path, { 'src/a.ts': 'dev again\n' });
    git(repo.path, ['add', '-A']);
    await checkStagedChanges(repo.path, far());

    expect(await attachCommit(repo.path, far())).toBe(1);
    expect(failures()).toEqual([expect.objectContaining({ final_content: 'dev\n' })]);
    expect(attachedOutcomes()).toEqual(['failure']);
  });

  it('closes checks of a version that a commit of the same file replaced', async () => {
    await aiWrote('src/a.ts', 'ai\n');
    await writeFiles(repo.path, { 'src/a.ts': 'dev\n' });
    git(repo.path, ['add', '-A']);
    await checkStagedChanges(repo.path, far());
    git(repo.path, ['reset', '-q']);
    // The commit was aborted; the developer then commits yet another version, untracked by AI edits.
    await writeFiles(repo.path, { 'src/a.ts': 'final\n' });
    git(repo.path, ['add', '-A']);
    git(repo.path, ['commit', '-q', '-m', 'final']);
    await attachCommit(repo.path, far());
    expect(failures()).toEqual([]);
    expect(attachedOutcomes()).toEqual(['superseded']);
  });

  it('does not create the same failure twice', async () => {
    await aiWrote('src/a.ts', 'ai\n');
    await commit({ 'src/a.ts': 'dev\n' });
    expect(await attachCommit(repo.path, far())).toBe(0);
    expect(failures()).toHaveLength(1);
  });

  it('links the latest prompt of the same session before the first counted edit', async () => {
    await prompt('s1', 'older prompt');
    const wanted = await prompt('s1', 'add email validation');
    await prompt('s2', 'another session');
    await aiWrote('src/a.ts', 'v1\n', 's1');
    await prompt('s1', 'after the first edit');
    await aiWrote('src/a.ts', 'v2\n', 's1');
    await commit({ 'src/a.ts': 'dev\n' });
    expect(failures()[0]?.prompt_event_id).toBe(wanted);
    expect(failures()[0]?.ai_content).toBe('v2\n');
  });

  it('links no prompt from another session', async () => {
    await prompt('s2', 'another session');
    await aiWrote('src/a.ts', 'ai\n', 's1');
    await commit({ 'src/a.ts': 'dev\n' });
    expect(failures()[0]?.prompt_event_id).toBeNull();
  });

  it('creates nothing before init and nothing after the deadline', async () => {
    expect(await attachCommit(repo.path, far())).toBe(0);
    expect(await readdir(repo.path)).not.toContain('.nightowl');
    await aiWrote('src/a.ts', 'ai\n');
    await writeFiles(repo.path, { 'src/a.ts': 'dev\n' });
    git(repo.path, ['add', '-A']);
    await checkStagedChanges(repo.path, far());
    git(repo.path, ['commit', '-q', '-m', 'x']);
    expect(await attachCommit(repo.path, Date.now())).toBe(0);
    expect(failures()).toEqual([]);
  });

  describe('AI redoing its edit after feedback', () => {
    it('records the edit the developer pushed back on, once, against the commit', async () => {
      const ask = await prompt('s1', 'isAdult is true from 18');
      const wrong = await aiWrote('src/age.ts', 'const isAdult = (age) => age > 18;\n');
      const feedback = await prompt('s1', 'wrong, 18 counts');
      await aiWrote('src/age.ts', 'const isAdult = (age) => age >= 18;\n');
      const sha = await commit();
      expect(failures()).toEqual([
        expect.objectContaining({
          file_path: 'src/age.ts',
          source: 'ai-self-fix',
          ai_event_id: wrong,
          prompt_event_id: ask,
          feedback_event_id: feedback,
          ai_content: 'const isAdult = (age) => age > 18;\n',
          final_content: 'const isAdult = (age) => age >= 18;\n',
          commit_sha: sha,
        }),
      ]);
      expect(attachedOutcomes()).toEqual(['failure']);
    });

    it('records both when the developer also edits by hand', async () => {
      await prompt('s1', 'write it');
      await aiWrote('a.ts', 'x = 1\ny = 1\n');
      await prompt('s1', 'x must be 2');
      const latest = await aiWrote('a.ts', 'x = 2\ny = 1\n');
      await commit({ 'a.ts': 'x = 2\ny = 3\n' });
      expect(failures().map((row) => [row.source, row.ai_event_id === latest])).toEqual([
        ['manual-fix', true],
        ['ai-self-fix', false],
      ]);
      expect(attachedOutcomes()).toEqual(['failure']);
    });

    it.each([
      ['the AI only added lines', 'a = 1\n', 'a = 1\nb = 2\n'],
      ['only whitespace changed', 'a = 1\n', 'a  =  1\n'],
    ])('records nothing when %s', async (_label, before, after) => {
      await aiWrote('a.ts', before);
      await prompt('s1', 'and more');
      await aiWrote('a.ts', after);
      await commit();
      expect(failures()).toEqual([]);
      expect(attachedOutcomes()).toEqual(['not-a-failure']);
    });

    it('records only the manual fix when the AI added code and the developer removed a line', async () => {
      await aiWrote('a.ts', 'a\nb\nc\n');
      await prompt('s1', 'also add d');
      await aiWrote('a.ts', 'a\nb\nc\nd\n');
      await commit({ 'a.ts': 'a\nc\nd\n' });
      expect(failures().map((row) => row.source)).toEqual(['manual-fix']);
    });

    it('records the self-fix when an earlier commit attempt did not go through', async () => {
      const wrong = await aiWrote('a.ts', 'x = 1\n');
      await prompt('s1', 'x must be 2');
      await aiWrote('a.ts', 'x = 2\n');
      git(repo.path, ['add', '-A']);
      await checkStagedChanges(repo.path, far());
      await aiWrote('a.ts', 'x = 2;\n');
      await commit();
      expect(failures()).toEqual([expect.objectContaining({ source: 'ai-self-fix', ai_event_id: wrong })]);
    });

    it('ignores a self_fix whose feedback is not a prompt between the edits', async () => {
      await aiWrote('a.ts', 'x = 1\n');
      await prompt('s1', 'x must be 2');
      await aiWrote('a.ts', 'x = 2\n');
      git(repo.path, ['add', '-A']);
      await checkStagedChanges(repo.path, far());
      const db = new DatabaseSync(join(repo.path, '.nightowl/nightowl.db'));
      try {
        const other = db.prepare(`INSERT INTO events (created_at, source, kind, session_id, payload, agent) VALUES ('t', 'agent-hook', 'prompt', 's9', '{"prompt":"secret"}', 'claude-code') RETURNING id`).get() as { id: number };
        db.prepare(`UPDATE events SET payload = json_set(payload, '$.self_fix.feedback_event_id', ?) WHERE kind = 'commit-check'`).run(other.id);
      } finally {
        db.close();
      }
      git(repo.path, ['commit', '-q', '-m', 'x']);
      await attachCommit(repo.path, far());
      expect(failures()).toEqual([]);
    });

    it('records nothing when the commit does not hold the checked version', async () => {
      await aiWrote('a.ts', 'a = 1\n');
      await prompt('s1', 'no');
      await aiWrote('a.ts', 'a = 2\n');
      git(repo.path, ['add', '-A']);
      await checkStagedChanges(repo.path, far());
      await writeFiles(repo.path, { 'a.ts': 'a = 3\n' });
      git(repo.path, ['add', '-A']);
      git(repo.path, ['commit', '-q', '-m', 'other']);
      await attachCommit(repo.path, far());
      expect(failures()).toEqual([]);
    });
  });
});

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
      return store.insertEvent({ source: 'claude-code', kind, sessionId, filePath, payload }).id;
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
      }),
    ]);
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
});

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPrecommitCommand } from '../../src/commands/precommit.js';
import { openStore } from '../../src/storage/store.js';
import { createFakeIo } from '../helpers/fake-io.js';
import { createGitRepo, git } from '../helpers/git-repo.js';
import { type TempDir, writeFiles } from '../helpers/temp-repo.js';

describe('nightowl precommit', () => {
  let repo: TempDir;

  beforeEach(async () => {
    repo = await createGitRepo();
  });
  afterEach(() => repo.cleanup());

  async function aiWrote(file: string, content: string): Promise<number> {
    await writeFiles(repo.path, { [file]: content });
    const store = await openStore({ cwd: repo.path });
    try {
      return store.insertEvent({
        source: 'claude-code',
        kind: 'edit',
        sessionId: 's1',
        filePath: file,
        payload: { tool: 'Write', snapshot: content, snapshot_skipped: null },
      }).id;
    } finally {
      store.close();
    }
  }

  async function precommit(budgetMs?: number): Promise<{ code: number; out: string; err: string }> {
    const fake = createFakeIo();
    const command = createPrecommitCommand({ cwd: () => repo.path, ...(budgetMs === undefined ? {} : { budgetMs }) });
    const code = await command.run([], fake.io);
    return { code, out: fake.out(), err: fake.err() };
  }

  async function checks(): Promise<Array<{ filePath: string | null; payload: Record<string, unknown> }>> {
    const store = await openStore({ cwd: repo.path });
    try {
      return store
        .listEvents({ kinds: ['commit-check'] })
        .map((event) => ({ filePath: event.filePath, payload: event.payload as Record<string, unknown> }));
    } finally {
      store.close();
    }
  }

  function commitAll(message: string): void {
    git(repo.path, ['add', '-A']);
    git(repo.path, ['commit', '-q', '-m', message]);
  }

  it('does nothing and creates nothing before init', async () => {
    await writeFiles(repo.path, { 'a.ts': 'x' });
    git(repo.path, ['add', '-A']);
    expect(await precommit()).toEqual({ code: 0, out: '', err: '' });
    expect(await readdir(repo.path)).not.toContain('.nightowl');
  });

  it('records unchanged when the AI version is committed as is', async () => {
    const id = await aiWrote('src/a.ts', 'export const a = 1;\n');
    git(repo.path, ['add', '-A']);
    expect(await precommit()).toEqual({ code: 0, out: '', err: '' });
    expect(await checks()).toEqual([
      {
        filePath: 'src/a.ts',
        payload: expect.objectContaining({ ai_event_ids: [id], outcome: 'unchanged', lines_added: 0, lines_removed: 0 }),
      },
    ]);
  });

  it('records modified with line counts and the staged content when the developer changed it', async () => {
    await aiWrote('src/a.ts', 'a\nb\nc\n');
    await writeFiles(repo.path, { 'src/a.ts': 'a\nB\nc\nd\n' });
    git(repo.path, ['add', '-A']);
    await precommit();
    const [check] = await checks();
    expect(check?.payload).toMatchObject({
      outcome: 'modified',
      lines_added: 2,
      lines_removed: 1,
      whitespace_only: false,
      staged_content: 'a\nB\nc\nd\n',
      staged_skipped: null,
    });
    expect(check?.payload.staged_blob).toMatch(/^[0-9a-f]{40,64}$/);
  });

  it('ignores files the AI never touched', async () => {
    await aiWrote('src/a.ts', 'x\n');
    await writeFiles(repo.path, { 'README.md': '# hi\n' });
    git(repo.path, ['add', '-A']);
    await precommit();
    expect((await checks()).map((c) => c.filePath)).toEqual(['src/a.ts']);
  });

  it('checks each AI edit only once across commits', async () => {
    await aiWrote('src/a.ts', 'v1\n');
    git(repo.path, ['add', '-A']);
    await precommit();
    commitAll('first');
    await writeFiles(repo.path, { 'src/a.ts': 'v1 tweaked by hand\n' });
    git(repo.path, ['add', '-A']);
    await precommit();
    expect(await checks()).toHaveLength(1);
  });

  it('compares with the latest of several AI edits and counts them all', async () => {
    const ids = [await aiWrote('src/a.ts', 'v1\n'), await aiWrote('src/a.ts', 'v2\n'), await aiWrote('src/a.ts', 'v3\n')];
    git(repo.path, ['add', '-A']);
    await precommit();
    const all = await checks();
    expect(all).toHaveLength(1);
    expect(all[0]?.payload).toMatchObject({ ai_event_ids: ids, outcome: 'unchanged' });
  });

  it('does not compare against an older snapshot when the latest edit has none', async () => {
    const first = await aiWrote('src/a.ts', 'v1\n');
    const store = await openStore({ cwd: repo.path });
    const second = store.insertEvent({
      source: 'claude-code',
      kind: 'edit',
      filePath: 'src/a.ts',
      payload: { tool: 'Write', snapshot: null, snapshot_skipped: 'too_large' },
    }).id;
    store.close();
    await writeFiles(repo.path, { 'src/a.ts': 'huge\n' });
    git(repo.path, ['add', '-A']);
    await precommit();
    expect(await checks()).toEqual([
      { filePath: 'src/a.ts', payload: { ai_event_ids: [first, second], outcome: 'skipped', skipped_reason: 'no_snapshot' } },
    ]);
  });

  it('flags whitespace-only edits', async () => {
    await aiWrote('src/a.ts', 'if (a) {\n  b();\n}\n');
    await writeFiles(repo.path, { 'src/a.ts': 'if (a) {\n    b();\n}\n' });
    git(repo.path, ['add', '-A']);
    await precommit();
    expect((await checks())[0]?.payload).toMatchObject({ outcome: 'modified', whitespace_only: true });
  });

  it('never stores who made the commit', async () => {
    await aiWrote('src/a.ts', 'x\n');
    await writeFiles(repo.path, { 'src/a.ts': 'y\n' });
    git(repo.path, ['add', '-A']);
    await precommit();
    const raw = JSON.stringify(await checks());
    expect(raw).not.toContain('Nguyen Test Dev');
    expect(raw).not.toContain('dev@example.test');
  });

  it('logs a corrupt database to nightowl.log and stays silent', async () => {
    await writeFiles(repo.path, { '.nightowl/nightowl.db': 'not a database', 'a.ts': 'x' });
    git(repo.path, ['add', 'a.ts']);
    expect(await precommit()).toEqual({ code: 0, out: '', err: '' });
    expect(await readFile(join(repo.path, '.nightowl/nightowl.log'), 'utf8')).toMatch(/ precommit /);
  });

  it('exits 0 even if the working directory cannot be read', async () => {
    const fake = createFakeIo();
    const command = createPrecommitCommand({
      cwd: () => {
        throw new Error('ENOENT: uv_cwd');
      },
    });
    expect(await command.run([], fake.io)).toBe(0);
    expect(fake.err()).toBe('');
  });

  it('stops when the time budget is used up and still exits 0', async () => {
    await aiWrote('src/a.ts', 'x\n');
    git(repo.path, ['add', '-A']);
    expect((await precommit(0)).code).toBe(0);
    expect(await checks()).toEqual([]);
  });

  it('handles 500 AI-edited files within 3 seconds', async () => {
    const files = Object.fromEntries(Array.from({ length: 500 }, (_, i) => [`src/f${i}.ts`, `export const v${i} = ${i};\n`]));
    await writeFiles(repo.path, files);
    const store = await openStore({ cwd: repo.path });
    for (const [file, content] of Object.entries(files)) {
      store.insertEvent({ source: 'claude-code', kind: 'edit', filePath: file, payload: { snapshot: content } });
    }
    store.close();
    git(repo.path, ['add', '-A']);
    const started = Date.now();
    expect((await precommit()).code).toBe(0);
    expect(Date.now() - started).toBeLessThan(3_000);
    expect((await checks()).length).toBeGreaterThan(0);
  }, 30_000);
});

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLogCommand, LOG_STDIN_TIMEOUT_MS } from '../../src/commands/log.js';
import { recordClaudeCodeEvent } from '../../src/hooks/claude-code/record.js';
import { openStore } from '../../src/storage/store.js';
import { createFakeIo, type FakeIoOptions } from '../helpers/fake-io.js';
import { hookFixture } from '../helpers/fixtures.js';
import { createFakeRepo, type TempDir, writeFiles } from '../helpers/temp-repo.js';

describe('log', () => {
  let repo: TempDir;
  let logCommand: ReturnType<typeof createLogCommand>;

  beforeEach(async () => {
    repo = await createFakeRepo();
    logCommand = createLogCommand({ cwd: () => repo.path, record: recordClaudeCodeEvent });
  });
  afterEach(() => repo.cleanup());

  const cases: ReadonlyArray<[string, FakeIoOptions]> = [
    ['valid JSON', { stdin: '{"hook_event_name":"PostToolUse","tool_name":"Edit"}' }],
    ['invalid JSON', { stdin: 'not json' }],
    ['empty stdin', { stdin: '' }],
    ['a failing stdin read', { readError: new Error('EPIPE') }],
  ];

  it.each(cases)('exits 0 silently for %s', async (_label, options) => {
    const fake = createFakeIo(options);
    expect(await logCommand.run([], fake.io)).toBe(0);
    expect(fake.out()).toBe('');
    expect(fake.err()).toBe('');
    expect(fake.stdinReads()).toBe(1);
  });

  it('bounds the stdin read so a stuck pipe cannot block the hook', async () => {
    const fake = createFakeIo({ stdin: '{}' });
    await logCommand.run([], fake.io);
    expect(fake.stdinTimeouts()).toEqual([LOG_STDIN_TIMEOUT_MS]);
    expect(LOG_STDIN_TIMEOUT_MS).toBeLessThan(1_000);
  });

  it('does not wait on stdin when it is an interactive terminal', async () => {
    const fake = createFakeIo({ isTTY: true });
    expect(await logCommand.run([], fake.io)).toBe(0);
    expect(fake.stdinReads()).toBe(0);
  });

  it('exits 0 silently even if recording throws', async () => {
    const failing = createLogCommand({
      cwd: () => repo.path,
      record: async () => {
        throw new Error('boom');
      },
    });
    const fake = createFakeIo({ stdin: '{}' });
    expect(await failing.run([], fake.io)).toBe(0);
    expect(fake.err()).toBe('');
  });

  it('stores a prompt and an edit from real hook payloads', async () => {
    await writeFiles(repo.path, { 'src/a.ts': 'export const a = 2;\n' });
    await logCommand.run([], createFakeIo({ stdin: hookFixture('user-prompt-submit', repo.path) }).io);
    await logCommand.run([], createFakeIo({ stdin: hookFixture('post-tool-use-edit', repo.path) }).io);
    const store = await openStore({ cwd: repo.path });
    try {
      expect(store.listEvents().map((e) => [e.kind, e.filePath, e.sessionId])).toEqual([
        ['prompt', null, 's1'],
        ['edit', 'src/a.ts', 's1'],
      ]);
    } finally {
      store.close();
    }
  });

  it('records a broken payload in nightowl.log without its content', async () => {
    await logCommand.run([], createFakeIo({ stdin: 'secret-code-123' }).io);
    const log = await readFile(join(repo.path, '.nightowl', 'nightowl.log'), 'utf8');
    expect(log.trimEnd().split('\n')).toHaveLength(1);
    expect(log).not.toContain('secret-code-123');
  });

  it('writes the error log when the database cannot be opened', async () => {
    await writeFiles(repo.path, { '.nightowl/nightowl.db': 'not a database', 'src/a.ts': 'x' });
    const fake = createFakeIo({ stdin: hookFixture('post-tool-use-edit', repo.path) });
    expect(await logCommand.run([], fake.io)).toBe(0);
    expect(await readFile(join(repo.path, '.nightowl', 'nightowl.log'), 'utf8')).toMatch(/ log /);
  });

  it('does nothing outside a repository', async () => {
    const outsideLog = createLogCommand({ cwd: () => '/', record: recordClaudeCodeEvent });
    const fake = createFakeIo({ stdin: 'not json' });
    expect(await outsideLog.run([], fake.io)).toBe(0);
  });
});

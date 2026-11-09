import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CLASSIFICATION_SCHEMA } from '../../src/classify/parse.js';
import {
  ClaudeError,
  killProcessTree,
  runClaude,
} from '../../src/classify/run-claude.js';
import { createFakeClaude, type FakeClaude } from '../helpers/fake-claude.js';

describe('killProcessTree', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does nothing when pid is undefined', () => {
    expect(() => killProcessTree(undefined)).not.toThrow();
  });

  it('calls process.kill with negative pid on POSIX platforms', () => {
    const killMock = vi.fn();
    killProcessTree(99999, 'darwin', { kill: killMock as unknown as typeof process.kill });
    expect(killMock).toHaveBeenCalledWith(-99999, 'SIGKILL');
  });

  it('swallows errors when process is already gone on POSIX', () => {
    const killMock = vi.fn().mockImplementation(() => {
      throw new Error('ESRCH');
    });
    expect(() => killProcessTree(99999, 'linux', { kill: killMock as unknown as typeof process.kill })).not.toThrow();
  });

  it('calls taskkill on Windows', () => {
    const spawnSyncMock = vi.fn().mockReturnValue({ status: 0 });
    killProcessTree(12345, 'win32', { spawnSync: spawnSyncMock as unknown as typeof import('node:child_process').spawnSync });
    expect(spawnSyncMock).toHaveBeenCalledWith('taskkill', ['/pid', '12345', '/T', '/F'], { stdio: 'ignore' });
  });

  it('falls back to process.kill on Windows if taskkill throws', () => {
    const spawnSyncMock = vi.fn().mockImplementation(() => {
      throw new Error('taskkill not found');
    });
    const killMock = vi.fn();
    killProcessTree(12345, 'win32', {
      spawnSync: spawnSyncMock as unknown as typeof import('node:child_process').spawnSync,
      kill: killMock as unknown as typeof process.kill,
    });
    expect(killMock).toHaveBeenCalledWith(12345, 'SIGKILL');
  });

  it('swallows process.kill errors on Windows fallback when already gone', () => {
    const spawnSyncMock = vi.fn().mockImplementation(() => {
      throw new Error('taskkill not found');
    });
    const killMock = vi.fn().mockImplementation(() => {
      throw new Error('ESRCH');
    });
    expect(() =>
      killProcessTree(12345, 'win32', {
        spawnSync: spawnSyncMock as unknown as typeof import('node:child_process').spawnSync,
        kill: killMock as unknown as typeof process.kill,
      }),
    ).not.toThrow();
  });
});

describe('runClaude', () => {
  let fake: FakeClaude | undefined;
  afterEach(async () => {
    await fake?.dir.cleanup();
    fake = undefined;
  });

  it('calls claude non-interactively with no tools, the schema and the model, prompt on stdin', async () => {
    fake = await createFakeClaude('{"result":"ok"}');
    const out = await runClaude('the prompt', { model: 'haiku', schema: CLASSIFICATION_SCHEMA, env: { ...process.env, PATH: fake.path } });
    expect(out).toBe('{"result":"ok"}');
    const [call] = await fake.calls();
    expect(call?.args).toEqual([
      '-p',
      '--output-format',
      'json',
      '--json-schema',
      JSON.stringify(CLASSIFICATION_SCHEMA),
      '--tools',
      '',
      '--strict-mcp-config',
      '--mcp-config',
      '{"mcpServers":{}}',
      '--disable-slash-commands',
      '--permission-mode',
      'dontAsk',
      '--no-session-persistence',
      '--model',
      'haiku',
    ]);
    expect(call?.stdin).toBe('the prompt');
    expect(call?.internal).toBe('1');
    expect(call?.args.join(' ')).not.toContain('the prompt');
  });

  it('passes the schema it is given', async () => {
    fake = await createFakeClaude('{}');
    const schema = { type: 'object', properties: { content: { type: 'string' } } };
    await runClaude('p', { model: 'sonnet', schema, env: { ...process.env, PATH: fake.path } });
    const [call] = await fake.calls();
    expect(call?.args[call.args.indexOf('--json-schema') + 1]).toBe(JSON.stringify(schema));
    expect(call?.args.at(-1)).toBe('sonnet');
  });

  it('runs in an empty temporary directory that is removed afterwards', async () => {
    fake = await createFakeClaude({ body: 'ls -A; echo "{}"' });
    const out = await runClaude('p', { model: 'haiku', schema: CLASSIFICATION_SCHEMA, env: { ...process.env, PATH: fake.path } });
    expect(out).toBe('{}\n');
    const [call] = await fake.calls();
    expect(call?.cwd).toMatch(/nightowl-classify-/);
    expect(call?.cwd).not.toBe(process.cwd());
    expect(existsSync(call?.cwd ?? '')).toBe(false);
  });

  it('reports a missing claude', async () => {
    await expect(runClaude('p', { model: 'haiku', schema: CLASSIFICATION_SCHEMA, env: { PATH: '/nonexistent' } })).rejects.toMatchObject({
      name: 'ClaudeError',
      reason: 'not_found',
    });
  });

  it('stops claude as soon as its output passes 4 MB', async () => {
    fake = await createFakeClaude({ body: 'head -c 5000000 /dev/zero; sleep 30' });
    const started = Date.now();
    await expect(runClaude('p', { model: 'haiku', schema: CLASSIFICATION_SCHEMA, env: { ...process.env, PATH: fake.path } })).rejects.toMatchObject({
      reason: 'too_large',
    });
    expect(Date.now() - started).toBeLessThan(10_000);
  });

  it('reports a failing claude', async () => {
    fake = await createFakeClaude({ body: 'exit 3' });
    await expect(runClaude('p', { model: 'haiku', schema: CLASSIFICATION_SCHEMA, env: { ...process.env, PATH: fake.path } })).rejects.toMatchObject({
      reason: 'exit',
    });
  });

  it('kills claude and what it started when it takes too long', async () => {
    fake = await createFakeClaude({ body: `sleep 30 & echo $! > "${'$'}base.child"; wait` });
    const started = Date.now();
    const error = await runClaude('p', { model: 'haiku', schema: CLASSIFICATION_SCHEMA, timeoutMs: 1_500, env: { ...process.env, PATH: fake.path } }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ClaudeError);
    expect((error as ClaudeError).reason).toBe('timeout');
    expect(Date.now() - started).toBeLessThan(4_000);
    const { readFile } = await import('node:fs/promises');
    const childPid = Number(await readFile(join(fake.dir.path, 'call-0.child'), 'utf8'));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(() => process.kill(childPid, 0)).toThrow();
  });

  it('supports platform override for windows', async () => {
    fake = await createFakeClaude('{"result":"win32"}');
    const out = await runClaude('prompt', {
      model: 'haiku',
      schema: CLASSIFICATION_SCHEMA,
      platform: 'win32',
      env: { ...process.env, PATH: fake.path },
    });
    expect(out).toBe('{"result":"win32"}');
  });
});

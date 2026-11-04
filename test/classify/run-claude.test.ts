import { existsSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { CLASSIFICATION_SCHEMA } from '../../src/classify/parse.js';
import { ClaudeError, runClaude } from '../../src/classify/run-claude.js';
import { createFakeClaude, type FakeClaude } from '../helpers/fake-claude.js';

describe('runClaude', () => {
  let fake: FakeClaude | undefined;
  afterEach(async () => {
    await fake?.dir.cleanup();
    fake = undefined;
  });

  it('calls claude non-interactively with no tools, the schema and the model, prompt on stdin', async () => {
    fake = await createFakeClaude('{"result":"ok"}');
    const out = await runClaude('the prompt', { model: 'haiku', env: { ...process.env, PATH: fake.path } });
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
      '--no-session-persistence',
      '--model',
      'haiku',
    ]);
    expect(call?.stdin).toBe('the prompt');
    expect(call?.internal).toBe('1');
    expect(call?.args.join(' ')).not.toContain('the prompt');
  });

  it('runs in an empty temporary directory that is removed afterwards', async () => {
    fake = await createFakeClaude({ body: 'ls -A; echo "{}"' });
    const out = await runClaude('p', { model: 'haiku', env: { ...process.env, PATH: fake.path } });
    expect(out).toBe('{}\n');
    const [call] = await fake.calls();
    expect(call?.cwd).toMatch(/nightowl-classify-/);
    expect(call?.cwd).not.toBe(process.cwd());
    expect(existsSync(call?.cwd ?? '')).toBe(false);
  });

  it('reports a missing claude', async () => {
    await expect(runClaude('p', { model: 'haiku', env: { PATH: '/nonexistent' } })).rejects.toMatchObject({
      name: 'ClaudeError',
      reason: 'not_found',
    });
  });

  it('reports a failing claude', async () => {
    fake = await createFakeClaude({ body: 'exit 3' });
    await expect(runClaude('p', { model: 'haiku', env: { ...process.env, PATH: fake.path } })).rejects.toMatchObject({
      reason: 'exit',
    });
  });

  it('kills claude when it takes too long', async () => {
    fake = await createFakeClaude({ body: 'sleep 5' });
    const started = Date.now();
    const error = await runClaude('p', { model: 'haiku', timeoutMs: 200, env: { ...process.env, PATH: fake.path } }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ClaudeError);
    expect((error as ClaudeError).reason).toBe('timeout');
    expect(Date.now() - started).toBeLessThan(2_000);
  });
});

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ClaudeSettingsError,
  ensureClaudeHooks,
  HOOK_COMMAND_LINE,
  mergeClaudeHooks,
} from '../../src/setup/claude-settings.js';
import { createFakeRepo, type TempDir } from '../helpers/temp-repo.js';

const nightowlHook = { type: 'command', command: HOOK_COMMAND_LINE, timeout: 5 };

describe('mergeClaudeHooks', () => {
  it('adds both hooks to empty settings', () => {
    const result = mergeClaudeHooks({});
    expect(result.added).toEqual(['PostToolUse', 'UserPromptSubmit']);
    expect(result.settings).toEqual({
      hooks: {
        PostToolUse: [{ matcher: 'Edit|Write|MultiEdit', hooks: [nightowlHook] }],
        UserPromptSubmit: [{ hooks: [nightowlHook] }],
      },
    });
  });

  it('keeps other settings and hooks, and does not mutate the input', () => {
    const input = {
      permissions: { allow: ['Bash(npm test)'] },
      hooks: { PostToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo hi' }] }] },
    };
    const snapshot = structuredClone(input);
    const { settings } = mergeClaudeHooks(input);
    expect(input).toEqual(snapshot);
    expect(settings).toMatchObject({ permissions: { allow: ['Bash(npm test)'] } });
    expect((settings as { hooks: { PostToolUse: unknown[] } }).hooks.PostToolUse).toEqual([
      { matcher: 'Bash', hooks: [{ type: 'command', command: 'echo hi' }] },
      { matcher: 'Edit|Write|MultiEdit', hooks: [nightowlHook] },
    ]);
  });

  it('adds nothing when the hooks already exist', () => {
    const once = mergeClaudeHooks({}).settings;
    const twice = mergeClaudeHooks(once);
    expect(twice.added).toEqual([]);
    expect(twice.settings).toEqual(once);
  });

  it.each([
    ['a JSON array', []],
    ['hooks that are not an object', { hooks: [] }],
    ['an event that is not a list', { hooks: { PostToolUse: {} } }],
  ])('rejects %s', (_label, input) => {
    expect(() => mergeClaudeHooks(input)).toThrow(ClaudeSettingsError);
  });
});

describe('ensureClaudeHooks', () => {
  let repo: TempDir;
  const file = () => join(repo.path, '.claude', 'settings.json');

  beforeEach(async () => {
    repo = await createFakeRepo();
  });
  afterEach(() => repo.cleanup());

  it('creates .claude/settings.json with two-space JSON and a final newline', async () => {
    expect(await ensureClaudeHooks(repo.path)).toEqual({ status: 'created', added: ['PostToolUse', 'UserPromptSubmit'] });
    const text = await readFile(file(), 'utf8');
    expect(text.endsWith('}\n')).toBe(true);
    expect(text).toContain('\n  "hooks": {');
  });

  it('is idempotent', async () => {
    await ensureClaudeHooks(repo.path);
    const first = await readFile(file(), 'utf8');
    expect(await ensureClaudeHooks(repo.path)).toEqual({ status: 'unchanged', added: [] });
    expect(await readFile(file(), 'utf8')).toBe(first);
  });

  it('refuses to touch invalid JSON and names the file', async () => {
    await mkdir(join(repo.path, '.claude'));
    await writeFile(file(), '{ broken');
    const error = await ensureClaudeHooks(repo.path).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ClaudeSettingsError);
    expect((error as Error).message).toContain(file());
    expect(await readFile(file(), 'utf8')).toBe('{ broken');
  });
});

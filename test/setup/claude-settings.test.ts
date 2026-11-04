import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  ClaudeSettingsError,
  ensureClaudeHooks,
  hasNightowlHooks,
  HOOK_COMMAND_LINE,
  LEGACY_HOOK_COMMAND,
  mergeClaudeHooks,
  removeClaudeHooks,
  SHARED_SETTINGS,
} from '../../src/setup/claude-settings.js';
import { createFakeRepo, type TempDir } from '../helpers/temp-repo.js';

const nightowlHook = { type: 'command', command: HOOK_COMMAND_LINE, timeout: 5 };
const legacyHook = { type: 'command', command: LEGACY_HOOK_COMMAND, timeout: 5 };
const otherHook = { type: 'command', command: 'echo hi' };

describe('HOOK_COMMAND_LINE', () => {
  it('exits 0 silently when nightowl is not on PATH', () => {
    const result = spawnSync('/bin/sh', ['-c', HOOK_COMMAND_LINE], {
      env: { PATH: '/usr/bin:/bin' },
      input: '{"hook_event_name":"UserPromptSubmit"}',
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });
});

describe('hasNightowlHooks', () => {
  it.each([
    ['the current hook', { hooks: { UserPromptSubmit: [{ hooks: [nightowlHook] }] } }, true],
    ['the legacy hook', { hooks: { PostToolUse: [{ matcher: 'Edit', hooks: [legacyHook] }] } }, true],
    ['other hooks only', { hooks: { PostToolUse: [{ hooks: [otherHook] }] } }, false],
    ['no hooks', {}, false],
    ['malformed hooks', { hooks: { PostToolUse: 'x' } }, false],
  ])('is right for %s', (_label, settings, expected) => {
    expect(hasNightowlHooks(settings)).toBe(expected);
  });
});

describe('removeClaudeHooks', () => {
  it('removes NightOwl hooks in both forms, keeping everything else', () => {
    const input = {
      permissions: { allow: ['Bash(npm test)'] },
      hooks: {
        PostToolUse: [
          { matcher: 'Bash', hooks: [otherHook] },
          { matcher: 'Edit|Write|MultiEdit', hooks: [nightowlHook] },
          { matcher: 'Write', hooks: [otherHook, legacyHook] },
        ],
        UserPromptSubmit: [{ hooks: [legacyHook] }],
      },
    };
    const snapshot = structuredClone(input);
    const result = removeClaudeHooks(input);
    expect(input).toEqual(snapshot);
    expect(result.removed).toBe(3);
    expect(result.empty).toBe(false);
    expect(result.settings).toEqual({
      permissions: { allow: ['Bash(npm test)'] },
      hooks: {
        PostToolUse: [
          { matcher: 'Bash', hooks: [otherHook] },
          { matcher: 'Write', hooks: [otherHook] },
        ],
      },
    });
  });

  it('leaves nothing behind when the settings held only NightOwl', () => {
    const result = removeClaudeHooks(mergeClaudeHooks({}).settings);
    expect(result).toEqual({ settings: {}, removed: 2, empty: true });
  });

  it('changes nothing without NightOwl hooks', () => {
    const input = { hooks: { PostToolUse: [{ hooks: [otherHook] }], Stop: [] } };
    expect(removeClaudeHooks(input)).toEqual({ settings: input, removed: 0, empty: false });
  });

  it('rejects settings that are not an object', () => {
    expect(() => removeClaudeHooks([])).toThrow(ClaudeSettingsError);
  });
});

describe('mergeClaudeHooks', () => {
  it('adds both hooks to empty settings', () => {
    const result = mergeClaudeHooks({});
    expect(result.added).toEqual(['PostToolUse', 'UserPromptSubmit']);
    expect(result.upgraded).toBe(0);
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

  it('upgrades the legacy hook in place, keeping its matcher, timeout and position', () => {
    const input = {
      hooks: {
        PostToolUse: [
          { matcher: 'Edit|Write', hooks: [otherHook, { ...legacyHook, timeout: 9 }] },
          { matcher: 'Bash', hooks: [otherHook] },
        ],
        UserPromptSubmit: [{ hooks: [legacyHook] }],
      },
    };
    const result = mergeClaudeHooks(input);
    expect(result.added).toEqual([]);
    expect(result.upgraded).toBe(2);
    expect(result.settings).toEqual({
      hooks: {
        PostToolUse: [
          { matcher: 'Edit|Write', hooks: [otherHook, { ...nightowlHook, timeout: 9 }] },
          { matcher: 'Bash', hooks: [otherHook] },
        ],
        UserPromptSubmit: [{ hooks: [nightowlHook] }],
      },
    });
  });

  it('adds nothing when the hooks already exist', () => {
    const once = mergeClaudeHooks({}).settings;
    const twice = mergeClaudeHooks(once);
    expect(twice.added).toEqual([]);
    expect(twice.upgraded).toBe(0);
    expect(twice.settings).toBe(once);
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
    expect(await ensureClaudeHooks(repo.path, SHARED_SETTINGS)).toEqual({ status: 'created', added: ['PostToolUse', 'UserPromptSubmit'], upgraded: 0 });
    const text = await readFile(file(), 'utf8');
    expect(text.endsWith('}\n')).toBe(true);
    expect(text).toContain('\n  "hooks": {');
  });

  it('is idempotent', async () => {
    await ensureClaudeHooks(repo.path, SHARED_SETTINGS);
    const first = await readFile(file(), 'utf8');
    expect(await ensureClaudeHooks(repo.path, SHARED_SETTINGS)).toEqual({ status: 'unchanged', added: [], upgraded: 0 });
    expect(await readFile(file(), 'utf8')).toBe(first);
  });

  it('refuses to touch invalid JSON and names the file', async () => {
    await mkdir(join(repo.path, '.claude'));
    await writeFile(file(), '{ broken');
    const error = await ensureClaudeHooks(repo.path, SHARED_SETTINGS).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ClaudeSettingsError);
    expect((error as Error).message).toContain(file());
    expect(await readFile(file(), 'utf8')).toBe('{ broken');
  });
});

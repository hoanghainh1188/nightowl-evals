import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readTextIfExists, writeFileAtomic } from './fs-utils.js';
import type { FileChange } from './gitignore.js';

export const HOOK_COMMAND_LINE = 'nightowl log';
const HOOK_TIMEOUT_SECONDS = 5;

interface HookSpec {
  readonly event: 'PostToolUse' | 'UserPromptSubmit';
  readonly matcher?: string;
}

const HOOKS: readonly HookSpec[] = [
  { event: 'PostToolUse', matcher: 'Edit|Write|MultiEdit' },
  { event: 'UserPromptSubmit' },
];

export class ClaudeSettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClaudeSettingsError';
  }
}

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasNightowlHook(groups: readonly unknown[]): boolean {
  return groups.some(
    (group) =>
      isObject(group) &&
      Array.isArray(group.hooks) &&
      group.hooks.some((hook) => isObject(hook) && hook.command === HOOK_COMMAND_LINE),
  );
}

function hookGroup(spec: HookSpec): Json {
  const hook = { type: 'command', command: HOOK_COMMAND_LINE, timeout: HOOK_TIMEOUT_SECONDS };
  return spec.matcher === undefined ? { hooks: [hook] } : { matcher: spec.matcher, hooks: [hook] };
}

export interface MergeResult {
  readonly settings: Json;
  readonly added: readonly string[];
}

// Pure: returns new settings with NightOwl's hooks added; never edits or drops existing entries.
export function mergeClaudeHooks(settings: unknown): MergeResult {
  if (!isObject(settings)) throw new ClaudeSettingsError('settings must be a JSON object');
  const hooks = settings.hooks ?? {};
  if (!isObject(hooks)) throw new ClaudeSettingsError('"hooks" must be a JSON object');

  const added: string[] = [];
  const nextHooks: Json = { ...hooks };
  for (const spec of HOOKS) {
    const groups = hooks[spec.event] ?? [];
    if (!Array.isArray(groups)) throw new ClaudeSettingsError(`"hooks.${spec.event}" must be a list`);
    if (hasNightowlHook(groups)) continue;
    nextHooks[spec.event] = [...groups, hookGroup(spec)];
    added.push(spec.event);
  }
  return { settings: added.length === 0 ? settings : { ...settings, hooks: nextHooks }, added };
}

export async function ensureClaudeHooks(root: string): Promise<{ status: FileChange; added: readonly string[] }> {
  const dir = join(root, '.claude');
  const path = join(dir, 'settings.json');
  const text = await readTextIfExists(path);

  let current: unknown = {};
  if (text !== null) {
    try {
      current = JSON.parse(text);
    } catch (error) {
      throw new ClaudeSettingsError(`${path} is not valid JSON: ${(error as Error).message}`);
    }
  }

  let merged: MergeResult;
  try {
    merged = mergeClaudeHooks(current);
  } catch (error) {
    throw new ClaudeSettingsError(`${path}: ${(error as Error).message}`);
  }
  if (merged.added.length === 0) return { status: 'unchanged', added: [] };

  await mkdir(dir, { recursive: true });
  await writeFileAtomic(path, `${JSON.stringify(merged.settings, null, 2)}\n`);
  return { status: text === null ? 'created' : 'updated', added: merged.added };
}

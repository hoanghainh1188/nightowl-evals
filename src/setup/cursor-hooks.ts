import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { isSymlink, readTextIfExists, SetupError, writeFileAtomic } from './fs-utils.js';
import type { FileChange } from './gitignore.js';
import { HOOK_COMMAND_LINE, isNightowlCommand, LEGACY_HOOK_COMMAND } from './hook-command.js';

export const CURSOR_HOOKS_FILE = '.cursor/hooks.json';
const HOOK_EVENTS = ['beforeSubmitPrompt', 'afterFileEdit'] as const;

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function commandEntries(list: unknown): unknown[] {
  return Array.isArray(list) ? list : [];
}

function hasNightowl(list: unknown): boolean {
  return commandEntries(list).some((entry) => isObject(entry) && isNightowlCommand(entry.command));
}

export function hasCursorNightowlHooks(doc: unknown): boolean {
  if (!isObject(doc) || !isObject(doc.hooks)) return false;
  const hooks = doc.hooks;
  return HOOK_EVENTS.some((event) => hasNightowl(hooks[event]));
}

function nightowlEntry(): Json {
  return { command: HOOK_COMMAND_LINE };
}

export function mergeCursorHooks(existing: unknown): { value: Json; status: FileChange; added: number; upgraded: number } {
  const base: Json = isObject(existing) ? { ...existing } : {};
  const hooks: Json = isObject(base.hooks) ? { ...base.hooks } : {};
  let added = 0;
  let upgraded = 0;

  for (const event of HOOK_EVENTS) {
    const list = commandEntries(hooks[event]).map((entry) => {
      if (!isObject(entry)) return entry;
      if (entry.command === LEGACY_HOOK_COMMAND) {
        upgraded += 1;
        return { ...entry, command: HOOK_COMMAND_LINE };
      }
      return entry;
    });
    if (!hasNightowl(list)) {
      list.push(nightowlEntry());
      added += 1;
    }
    hooks[event] = list;
  }

  const value = { ...base, version: typeof base.version === 'number' ? base.version : 1, hooks };
  const status: FileChange = added > 0 || upgraded > 0 ? (isObject(existing) ? 'updated' : 'created') : 'unchanged';
  return { value, status: existing === undefined || existing === null ? (added > 0 ? 'created' : 'unchanged') : status, added, upgraded };
}

export function removeCursorHooks(existing: unknown): { value: Json | null; removed: number } {
  if (!isObject(existing) || !isObject(existing.hooks)) return { value: isObject(existing) ? existing : null, removed: 0 };
  const hooks: Json = { ...existing.hooks };
  let removed = 0;
  for (const event of HOOK_EVENTS) {
    const next = commandEntries(hooks[event]).filter((entry) => {
      if (isObject(entry) && isNightowlCommand(entry.command)) {
        removed += 1;
        return false;
      }
      return true;
    });
    if (next.length === 0) delete hooks[event];
    else hooks[event] = next;
  }
  if (Object.keys(hooks).length === 0) {
    const { hooks: _h, ...rest } = existing;
    // Drop files that only held NightOwl hooks (plus optional version).
    const keys = Object.keys(rest).filter((key) => key !== 'version');
    return { value: keys.length === 0 ? null : rest, removed };
  }
  return { value: { ...existing, hooks }, removed };
}

export async function installCursorHooks(root: string): Promise<{ file: string; status: FileChange; added: number; upgraded: number }> {
  const path = join(root, CURSOR_HOOKS_FILE);
  if (await isSymlink(path)) throw new SetupError(`${CURSOR_HOOKS_FILE} is a symlink; refusing to modify it`);
  const raw = await readTextIfExists(path);
  let existing: unknown = null;
  if (raw !== null) {
    try {
      existing = JSON.parse(raw);
    } catch {
      throw new SetupError(`${CURSOR_HOOKS_FILE} is not valid JSON`);
    }
  }
  const merged = mergeCursorHooks(existing);
  if (merged.status === 'unchanged') return { file: CURSOR_HOOKS_FILE, status: 'unchanged', added: 0, upgraded: 0 };
  await mkdir(dirname(path), { recursive: true });
  await writeFileAtomic(path, `${JSON.stringify(merged.value, null, 2)}\n`);
  return { file: CURSOR_HOOKS_FILE, status: existing === null ? 'created' : 'updated', added: merged.added, upgraded: merged.upgraded };
}

export async function uninstallCursorHooks(root: string): Promise<{ file: string; status: 'removed' | 'updated' | 'unchanged'; removed: number }> {
  const path = join(root, CURSOR_HOOKS_FILE);
  if (!(await readTextIfExists(path))) return { file: CURSOR_HOOKS_FILE, status: 'unchanged', removed: 0 };
  if (await isSymlink(path)) throw new SetupError(`${CURSOR_HOOKS_FILE} is a symlink; refusing to modify it`);
  const raw = await readTextIfExists(path);
  let existing: unknown;
  try {
    existing = JSON.parse(raw!);
  } catch {
    throw new SetupError(`${CURSOR_HOOKS_FILE} is not valid JSON`);
  }
  const { value, removed } = removeCursorHooks(existing);
  if (removed === 0) return { file: CURSOR_HOOKS_FILE, status: 'unchanged', removed: 0 };
  if (value === null) {
    const { rm } = await import('node:fs/promises');
    await rm(path);
    return { file: CURSOR_HOOKS_FILE, status: 'removed', removed };
  }
  await writeFileAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
  return { file: CURSOR_HOOKS_FILE, status: 'updated', removed };
}

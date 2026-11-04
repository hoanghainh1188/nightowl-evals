import { mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { isSymlink, readTextIfExists, SetupError, writeFileAtomic } from './fs-utils.js';
import type { FileChange } from './gitignore.js';

// `|| true` keeps Claude Code quiet on machines where nightowl is not installed.
export const HOOK_COMMAND_LINE = 'command -v nightowl >/dev/null 2>&1 && nightowl log >/dev/null 2>&1 || true';
// Written by NightOwl before the check above existed; still recognised, and upgraded by init.
export const LEGACY_HOOK_COMMAND = 'nightowl log';
const HOOK_TIMEOUT_SECONDS = 5;

export const SHARED_SETTINGS = '.claude/settings.json';
export const PERSONAL_SETTINGS = '.claude/settings.local.json';
export type SettingsFile = typeof SHARED_SETTINGS | typeof PERSONAL_SETTINGS;

interface HookSpec {
  readonly event: 'PostToolUse' | 'UserPromptSubmit';
  readonly matcher?: string;
}

const HOOKS: readonly HookSpec[] = [
  { event: 'PostToolUse', matcher: 'Edit|Write|MultiEdit' },
  { event: 'UserPromptSubmit' },
];

export class ClaudeSettingsError extends SetupError {
  constructor(message: string) {
    super(message);
    this.name = 'ClaudeSettingsError';
  }
}

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNightowlHook(hook: unknown): boolean {
  return isObject(hook) && (hook.command === HOOK_COMMAND_LINE || hook.command === LEGACY_HOOK_COMMAND);
}

function groupHooks(group: unknown): readonly unknown[] {
  return isObject(group) && Array.isArray(group.hooks) ? group.hooks : [];
}

function hasNightowlHook(groups: readonly unknown[]): boolean {
  return groups.some((group) => groupHooks(group).some(isNightowlHook));
}

export function hasNightowlHooks(settings: unknown): boolean {
  if (!isObject(settings) || !isObject(settings.hooks)) return false;
  return Object.values(settings.hooks).some((groups) => Array.isArray(groups) && hasNightowlHook(groups));
}

function hookGroup(spec: HookSpec): Json {
  const hook = { type: 'command', command: HOOK_COMMAND_LINE, timeout: HOOK_TIMEOUT_SECONDS };
  return spec.matcher === undefined ? { hooks: [hook] } : { matcher: spec.matcher, hooks: [hook] };
}

function readHooks(settings: unknown): Json {
  if (!isObject(settings)) throw new ClaudeSettingsError('settings must be a JSON object');
  const hooks = settings.hooks ?? {};
  if (!isObject(hooks)) throw new ClaudeSettingsError('"hooks" must be a JSON object');
  return hooks;
}

// Rewrites legacy NightOwl hooks of one event, leaving everything else (and the order) as is.
function upgradeGroups(groups: readonly unknown[]): { groups: readonly unknown[]; upgraded: number } {
  let upgraded = 0;
  const next = groups.map((group) => {
    if (!groupHooks(group).some((hook) => isObject(hook) && hook.command === LEGACY_HOOK_COMMAND)) return group;
    const hooks = groupHooks(group).map((hook) => {
      if (!isObject(hook) || hook.command !== LEGACY_HOOK_COMMAND) return hook;
      upgraded += 1;
      return { ...hook, command: HOOK_COMMAND_LINE };
    });
    return { ...(group as Json), hooks };
  });
  return { groups: next, upgraded };
}

export interface MergeResult {
  readonly settings: unknown;
  readonly added: readonly string[];
  readonly upgraded: number;
}

// Upgrades legacy hooks only: for a settings file NightOwl must not add hooks to.
export function upgradeClaudeHooks(settings: unknown): MergeResult {
  const hooks = readHooks(settings);
  let upgraded = 0;
  const nextHooks: Json = { ...hooks };
  for (const [event, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups)) continue;
    const result = upgradeGroups(groups);
    nextHooks[event] = result.groups;
    upgraded += result.upgraded;
  }
  return { settings: upgraded > 0 ? { ...(settings as Json), hooks: nextHooks } : settings, added: [], upgraded };
}

// Pure: returns new settings with NightOwl's hooks added or upgraded; never drops existing entries.
export function mergeClaudeHooks(settings: unknown): MergeResult {
  const { settings: upgradedSettings, upgraded } = upgradeClaudeHooks(settings);
  const hooks = readHooks(upgradedSettings);
  const added: string[] = [];
  const nextHooks: Json = { ...hooks };
  for (const spec of HOOKS) {
    const groups = hooks[spec.event] ?? [];
    if (!Array.isArray(groups)) throw new ClaudeSettingsError(`"hooks.${spec.event}" must be a list`);
    if (hasNightowlHook(groups)) continue;
    nextHooks[spec.event] = [...groups, hookGroup(spec)];
    added.push(spec.event);
  }
  if (added.length === 0) return { settings: upgradedSettings, added, upgraded };
  return { settings: { ...(upgradedSettings as Json), hooks: nextHooks }, added, upgraded };
}

export interface RemoveResult {
  readonly settings: unknown;
  readonly removed: number;
  // True when nothing is left: the file only held what NightOwl wrote.
  readonly empty: boolean;
}

function removeFromGroups(groups: readonly unknown[]): { groups: readonly unknown[]; removed: number } {
  let removed = 0;
  const next = groups.flatMap((group) => {
    const hooks = groupHooks(group);
    const kept = hooks.filter((hook) => !isNightowlHook(hook));
    if (kept.length === hooks.length) return [group];
    removed += hooks.length - kept.length;
    return kept.length === 0 ? [] : [{ ...(group as Json), hooks: kept }];
  });
  return { groups: next, removed };
}

// Pure: returns new settings without NightOwl hooks, dropping groups, events and `hooks` it empties.
export function removeClaudeHooks(settings: unknown): RemoveResult {
  const hooks = readHooks(settings);
  let removed = 0;
  const nextHooks: Json = {};
  for (const [event, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups)) {
      nextHooks[event] = groups;
      continue;
    }
    const result = removeFromGroups(groups);
    removed += result.removed;
    if (result.removed === 0 || result.groups.length > 0) nextHooks[event] = result.groups;
  }
  if (removed === 0) return { settings, removed: 0, empty: false };
  const { hooks: _dropped, ...rest } = settings as Json;
  const next = Object.keys(nextHooks).length === 0 ? rest : { ...rest, hooks: nextHooks };
  return { settings: next, removed, empty: Object.keys(next).length === 0 };
}

export interface SettingsText {
  readonly path: string;
  readonly exists: boolean;
  // The parsed JSON; `{}` when the file does not exist.
  readonly value: unknown;
}

export async function readSettings(root: string, file: SettingsFile): Promise<SettingsText> {
  const path = join(root, file);
  const text = await readTextIfExists(path);
  if (text === null) return { path, exists: false, value: {} };
  try {
    return { path, exists: true, value: JSON.parse(text) };
  } catch (error) {
    throw new ClaudeSettingsError(`${path} is not valid JSON: ${(error as Error).message}`);
  }
}

// Writing or deleting through a symlink would change a file shared with other projects.
export async function assertNotSymlinked(root: string, file: SettingsFile): Promise<void> {
  for (const path of [join(root, dirname(file)), join(root, file)]) {
    if (await isSymlink(path)) throw new ClaudeSettingsError(`${path} is a symlink; NightOwl does not edit it. Edit it by hand.`);
  }
}

async function writeSettings(path: string, settings: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFileAtomic(path, `${JSON.stringify(settings, null, 2)}\n`);
}

export function withPath<T>(path: string, run: () => T): T {
  try {
    return run();
  } catch (error) {
    throw new ClaudeSettingsError(`${path}: ${(error as Error).message}`);
  }
}

export interface EnsureResult {
  readonly status: FileChange;
  readonly added: readonly string[];
  readonly upgraded: number;
}

// Adds (or upgrades) NightOwl's hooks in `file`; with `upgradeOnly`, never adds new ones.
export async function ensureClaudeHooks(root: string, file: SettingsFile, upgradeOnly = false): Promise<EnsureResult> {
  const { path, exists, value } = await readSettings(root, file);
  if (!exists && upgradeOnly) return { status: 'unchanged', added: [], upgraded: 0 };
  const merged = withPath(path, () => (upgradeOnly ? upgradeClaudeHooks : mergeClaudeHooks)(value));
  if (merged.added.length === 0 && merged.upgraded === 0) return { status: 'unchanged', added: [], upgraded: 0 };
  await assertNotSymlinked(root, file);
  await writeSettings(path, merged.settings);
  return { status: exists ? 'updated' : 'created', added: merged.added, upgraded: merged.upgraded };
}

export type RemoveStatus = 'removed' | 'updated' | 'unchanged';

// Takes NightOwl's hooks out of `file`, deleting the file when nothing else is left in it.
export async function removeClaudeHooksFromFile(root: string, file: SettingsFile): Promise<RemoveStatus> {
  const { path, exists, value } = await readSettings(root, file);
  if (!exists) return 'unchanged';
  const result = withPath(path, () => removeClaudeHooks(value));
  if (result.removed === 0) return 'unchanged';
  await assertNotSymlinked(root, file);
  if (result.empty) {
    await rm(path);
    return 'removed';
  }
  await writeSettings(path, result.settings);
  return 'updated';
}

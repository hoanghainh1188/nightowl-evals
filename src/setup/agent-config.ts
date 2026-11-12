import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { AgentId } from '../agents/ids.js';
import { maturityOf } from '../agents/ids.js';
import { isSymlink, readTextIfExists, SetupError, writeFileAtomic } from './fs-utils.js';
import type { FileChange } from './gitignore.js';
import { HOOK_COMMAND_LINE, isNightowlCommand } from './hook-command.js';

export interface AgentConfigSpec {
  readonly id: AgentId;
  readonly file: string;
  readonly description: string;
}

/** Project config files NightOwl may write for best-effort agents (and clean on uninstall). */
export const AGENT_CONFIGS: readonly AgentConfigSpec[] = Object.freeze([
  { id: 'windsurf', file: '.windsurf/hooks.json', description: 'Windsurf hooks' },
  { id: 'cline', file: '.cline/nightowl.json', description: 'Cline NightOwl hook' },
  { id: 'roo', file: '.roo/nightowl.json', description: 'Roo Code NightOwl hook' },
]);

/** Legacy marker files from older init (manual agents); uninstall still removes them. */
export const LEGACY_AGENT_CONFIGS: readonly AgentConfigSpec[] = Object.freeze([
  { id: 'copilot-workspace', file: '.github/copilot-nightowl.json', description: 'Copilot Workspace NightOwl hook' },
  { id: 'aider', file: '.aider/nightowl.json', description: 'Aider NightOwl hook' },
]);

export const ALL_AGENT_CONFIGS: readonly AgentConfigSpec[] = Object.freeze([...AGENT_CONFIGS, ...LEGACY_AGENT_CONFIGS]);

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nightowlBlock(agent: AgentId): Json {
  return {
    nightowl: true,
    agent,
    command: HOOK_COMMAND_LINE,
    events: ['prompt', 'edit'],
  };
}

const WINDSURF_EVENTS = ['pre_user_prompt', 'post_file_edit'] as const;

function windsurfNightowlEntry(): Json {
  return { nightowl: true, agent: 'windsurf', command: HOOK_COMMAND_LINE };
}

function isCompleteMarker(entry: Json, agent: AgentId): boolean {
  return entry.nightowl === true && isNightowlCommand(entry.command) && (entry.agent === undefined || entry.agent === agent);
}

function completeMarker(existing: Json, agent: AgentId): Json {
  return {
    ...existing,
    nightowl: true,
    agent,
    command: isNightowlCommand(existing.command) ? existing.command : HOOK_COMMAND_LINE,
    events: Array.isArray(existing.events) ? existing.events : ['prompt', 'edit'],
  };
}

function hasNightowlCommand(list: unknown): boolean {
  return Array.isArray(list) && list.some((entry) => isObject(entry) && (entry.nightowl === true || isNightowlCommand(entry.command)));
}

function isCompleteWindsurfEntry(entry: unknown): boolean {
  return isObject(entry) && entry.nightowl === true && isNightowlCommand(entry.command);
}

export function mergeWindsurfHooks(existing: unknown): { value: Json; status: FileChange; added: boolean } {
  const base: Json = isObject(existing) ? { ...existing } : {};
  const hooks: Json = isObject(base.hooks) ? { ...base.hooks } : {};
  let added = false;
  for (const event of WINDSURF_EVENTS) {
    const list = Array.isArray(hooks[event]) ? [...(hooks[event] as unknown[])] : [];
    const idx = list.findIndex((entry) => isObject(entry) && (entry.nightowl === true || isNightowlCommand(entry.command)));
    if (idx < 0) {
      list.push(windsurfNightowlEntry());
      added = true;
    } else if (!isCompleteWindsurfEntry(list[idx])) {
      list[idx] = { ...(list[idx] as Json), ...windsurfNightowlEntry() };
      added = true;
    }
    hooks[event] = list;
  }
  if (!added && isObject(existing) && isObject(existing.hooks)) {
    return { value: existing, status: 'unchanged', added: false };
  }
  return { value: { ...base, hooks }, status: existing === null || existing === undefined ? 'created' : 'updated', added };
}

export function removeWindsurfHooks(existing: unknown): { value: Json | null; removed: boolean } {
  if (!isObject(existing) || !isObject(existing.hooks)) return { value: isObject(existing) ? existing : null, removed: false };
  const hooks: Json = { ...existing.hooks };
  let removed = false;
  for (const event of WINDSURF_EVENTS) {
    if (!Array.isArray(hooks[event])) continue;
    const next = (hooks[event] as unknown[]).filter(
      (entry) => !(isObject(entry) && (entry.nightowl === true || isNightowlCommand(entry.command))),
    );
    if (next.length !== (hooks[event] as unknown[]).length) removed = true;
    if (next.length === 0) delete hooks[event];
    else hooks[event] = next;
  }
  if (!removed) return { value: existing, removed: false };
  if (Object.keys(hooks).length === 0) {
    const { hooks: _h, ...rest } = existing;
    return { value: Object.keys(rest).length === 0 ? null : rest, removed: true };
  }
  return { value: { ...existing, hooks }, removed: true };
}

export function hasWindsurfNightowlHooks(doc: unknown): boolean {
  if (!isObject(doc) || !isObject(doc.hooks)) return false;
  const hooks = doc.hooks;
  return WINDSURF_EVENTS.some((event) => hasNightowlCommand(hooks[event]));
}

export function hasCompleteWindsurfShape(doc: unknown): boolean {
  if (!isObject(doc) || !isObject(doc.hooks)) return false;
  const hooks = doc.hooks;
  return WINDSURF_EVENTS.every((event) => {
    const list = hooks[event];
    return Array.isArray(list) && list.some((entry) => isCompleteWindsurfEntry(entry));
  });
}

export function mergeAgentConfig(existing: unknown, agent: AgentId): { value: Json; status: FileChange; added: boolean } {
  if (agent === 'windsurf') return mergeWindsurfHooks(existing);

  if (isObject(existing) && (existing.nightowl === true || isNightowlCommand(existing.command))) {
    if (isCompleteMarker(existing, agent)) return { value: existing, status: 'unchanged', added: false };
    return { value: completeMarker(existing, agent), status: 'updated', added: true };
  }
  if (isObject(existing) && Array.isArray(existing.hooks)) {
    const hooks = [...existing.hooks];
    const idx = hooks.findIndex((h) => isObject(h) && (h.nightowl === true || isNightowlCommand(h.command)));
    if (idx >= 0) {
      const entry = hooks[idx] as Json;
      if (isCompleteMarker(entry, agent)) return { value: existing, status: 'unchanged', added: false };
      hooks[idx] = completeMarker(entry, agent);
      return { value: { ...existing, hooks }, status: 'updated', added: true };
    }
    hooks.push(nightowlBlock(agent));
    return { value: { ...existing, hooks }, status: 'updated', added: true };
  }
  if (existing === null || existing === undefined) {
    return { value: nightowlBlock(agent), status: 'created', added: true };
  }
  if (isObject(existing)) {
    return { value: completeMarker(existing, agent), status: 'updated', added: true };
  }
  return { value: nightowlBlock(agent), status: 'created', added: true };
}

export function removeAgentConfig(existing: unknown, agent?: AgentId): { value: Json | null; removed: boolean } {
  if (agent === 'windsurf') return removeWindsurfHooks(existing);
  if (!isObject(existing)) return { value: null, removed: false };
  if (existing.nightowl === true || isNightowlCommand(existing.command)) {
    const { nightowl: _n, agent: _a, command: _c, events: _e, ...rest } = existing;
    return { value: Object.keys(rest).length === 0 ? null : rest, removed: true };
  }
  if (Array.isArray(existing.hooks)) {
    const hooks = existing.hooks.filter((h) => !(isObject(h) && (h.nightowl === true || isNightowlCommand(h.command))));
    const removed = hooks.length !== existing.hooks.length;
    if (!removed) return { value: existing, removed: false };
    if (hooks.length === 0) {
      const { hooks: _h, ...rest } = existing;
      return { value: Object.keys(rest).length === 0 ? null : rest, removed: true };
    }
    return { value: { ...existing, hooks }, removed: true };
  }
  return { value: existing, removed: false };
}

export function hasNightowlAgentMarker(doc: unknown, agent: AgentId): boolean {
  if (agent === 'windsurf') return hasWindsurfNightowlHooks(doc);
  if (!isObject(doc)) return false;
  if (doc.nightowl === true || isNightowlCommand(doc.command)) return true;
  if (Array.isArray(doc.hooks)) {
    return doc.hooks.some((h) => isObject(h) && (h.nightowl === true || isNightowlCommand(h.command)));
  }
  return false;
}

/** Stricter shape check for best-effort configs: nightowl flag + nightowl command (+ agent when set). */
export function hasCompleteBestEffortShape(doc: unknown, agent: AgentId): boolean {
  if (agent === 'windsurf') return hasCompleteWindsurfShape(doc);
  if (!isObject(doc)) return false;
  if (doc.nightowl === true || isNightowlCommand(doc.command)) return isCompleteMarker(doc, agent);
  if (Array.isArray(doc.hooks)) {
    return doc.hooks.some((h) => isObject(h) && isCompleteMarker(h, agent));
  }
  return false;
}

export async function installAgentConfig(root: string, spec: AgentConfigSpec): Promise<{ file: string; status: FileChange }> {
  // Defence in depth: installSelectedAgents skips manual agents and AGENT_CONFIGS excludes them.
  if (maturityOf(spec.id) === 'manual') {
    throw new SetupError(`${spec.id} is manual maturity; refusing to write a fake native hook at ${spec.file}`);
  }
  const path = join(root, spec.file);
  if (await isSymlink(path)) throw new SetupError(`${spec.file} is a symlink; refusing to modify it`);
  const raw = await readTextIfExists(path);
  let existing: unknown = null;
  if (raw !== null) {
    try {
      existing = JSON.parse(raw);
    } catch {
      throw new SetupError(`${spec.file} is not valid JSON`);
    }
  }
  const merged = mergeAgentConfig(existing, spec.id);
  if (merged.status === 'unchanged') return { file: spec.file, status: 'unchanged' };
  await mkdir(dirname(path), { recursive: true });
  await writeFileAtomic(path, `${JSON.stringify(merged.value, null, 2)}\n`);
  return { file: spec.file, status: existing === null ? 'created' : 'updated' };
}

export async function uninstallAgentConfig(root: string, spec: AgentConfigSpec): Promise<{ file: string; status: 'removed' | 'updated' | 'unchanged' }> {
  const path = join(root, spec.file);
  const raw = await readTextIfExists(path);
  if (raw === null) return { file: spec.file, status: 'unchanged' };
  if (await isSymlink(path)) throw new SetupError(`${spec.file} is a symlink; refusing to modify it`);
  let existing: unknown;
  try {
    existing = JSON.parse(raw);
  } catch {
    throw new SetupError(`${spec.file} is not valid JSON`);
  }
  const { value, removed } = removeAgentConfig(existing, spec.id);
  if (!removed) return { file: spec.file, status: 'unchanged' };
  if (value === null) {
    const { rm } = await import('node:fs/promises');
    await rm(path);
    return { file: spec.file, status: 'removed' };
  }
  await writeFileAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
  return { file: spec.file, status: 'updated' };
}

export function manualWrapHint(agent: AgentId): string {
  return `Pipe prompt/edit JSON into: nightowl log --agent ${agent} (see README maturity: manual)`;
}

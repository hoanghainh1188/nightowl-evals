import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { AgentId } from '../agents/ids.js';
import { isSymlink, readTextIfExists, SetupError, writeFileAtomic } from './fs-utils.js';
import type { FileChange } from './gitignore.js';
import { HOOK_COMMAND_LINE, isNightowlCommand } from './hook-command.js';

export interface AgentConfigSpec {
  readonly id: AgentId;
  readonly file: string;
  readonly description: string;
}

// Best-effort config paths + NightOwl marker entries for agents beyond Claude/Cursor.
export const AGENT_CONFIGS: readonly AgentConfigSpec[] = Object.freeze([
  { id: 'windsurf', file: '.windsurf/hooks.json', description: 'Windsurf hooks' },
  { id: 'cline', file: '.cline/nightowl.json', description: 'Cline NightOwl hook' },
  { id: 'roo', file: '.roo/nightowl.json', description: 'Roo Code NightOwl hook' },
  { id: 'copilot-workspace', file: '.github/copilot-nightowl.json', description: 'Copilot Workspace NightOwl hook' },
  { id: 'aider', file: '.aider/nightowl.json', description: 'Aider NightOwl hook' },
]);

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

export function mergeAgentConfig(existing: unknown, agent: AgentId): { value: Json; status: FileChange; added: boolean } {
  if (isObject(existing) && (existing.nightowl === true || isNightowlCommand(existing.command))) {
    return { value: existing, status: 'unchanged', added: false };
  }
  if (isObject(existing) && isObject(existing.hooks) && Array.isArray(existing.hooks)) {
    const hooks = [...existing.hooks];
    if (hooks.some((h) => isObject(h) && (h.nightowl === true || isNightowlCommand(h.command)))) {
      return { value: existing, status: 'unchanged', added: false };
    }
    hooks.push(nightowlBlock(agent));
    return { value: { ...existing, hooks }, status: 'updated', added: true };
  }
  if (existing === null || existing === undefined) {
    return { value: nightowlBlock(agent), status: 'created', added: true };
  }
  if (isObject(existing)) {
    return { value: { ...existing, ...nightowlBlock(agent) }, status: 'updated', added: true };
  }
  return { value: nightowlBlock(agent), status: 'created', added: true };
}

export function removeAgentConfig(existing: unknown): { value: Json | null; removed: boolean } {
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

export async function installAgentConfig(root: string, spec: AgentConfigSpec): Promise<{ file: string; status: FileChange }> {
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
  const { value, removed } = removeAgentConfig(existing);
  if (!removed) return { file: spec.file, status: 'unchanged' };
  if (value === null) {
    const { rm } = await import('node:fs/promises');
    await rm(path);
    return { file: spec.file, status: 'removed' };
  }
  await writeFileAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
  return { file: spec.file, status: 'updated' };
}

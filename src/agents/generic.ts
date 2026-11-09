import type { AgentId } from './ids.js';
import { isAgentId } from './ids.js';
import { normalizeEditFromDisk, normalizePrompt } from './snapshot.js';
import type { AgentParseResult } from './types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sessionId(data: Record<string, unknown>): string | null {
  for (const key of ['session_id', 'conversation_id', 'thread_id', 'chat_id'] as const) {
    if (typeof data[key] === 'string') return data[key];
  }
  return null;
}

function cwdOf(data: Record<string, unknown>, fallback: string): string {
  return typeof data.cwd === 'string' ? data.cwd : fallback;
}

function filePathOf(data: Record<string, unknown>): string | null {
  for (const key of ['file_path', 'filePath', 'path'] as const) {
    if (typeof data[key] === 'string') return data[key];
  }
  return null;
}

function promptOf(data: Record<string, unknown>): string | null {
  for (const key of ['prompt', 'text', 'message', 'user_message'] as const) {
    if (typeof data[key] === 'string') return data[key];
  }
  return null;
}

const KIND_HINTS: Readonly<Record<AgentId, { prompt?: readonly string[]; edit?: readonly string[] }>> = Object.freeze({
  'claude-code': {},
  cursor: {},
  windsurf: { prompt: ['pre_user_prompt', 'UserPromptSubmit'], edit: ['post_file_edit', 'after_file_edit', 'PostToolUse'] },
  cline: { prompt: ['task_prompt', 'UserPromptSubmit'], edit: ['file_edited', 'tool_result', 'PostToolUse'] },
  roo: { prompt: ['UserPromptSubmit', 'prompt'], edit: ['file_written', 'PostToolUse', 'after_edit'] },
  'copilot-workspace': { prompt: ['prompt_submitted', 'UserPromptSubmit'], edit: ['file_changed', 'PostToolUse'] },
  aider: { prompt: ['user_input', 'UserPromptSubmit'], edit: ['file_update', 'after_write', 'PostToolUse'] },
});

export function looksLikeAgent(data: Record<string, unknown>, agent: AgentId): boolean {
  if (data.agent === agent || data.nightowl_agent === agent) return true;
  const hints = KIND_HINTS[agent];
  const name = typeof data.hook_event_name === 'string' ? data.hook_event_name : typeof data.event === 'string' ? data.event : '';
  return Boolean(
    (hints.prompt?.includes(name) && promptOf(data) !== null) || (hints.edit?.includes(name) && filePathOf(data) !== null),
  );
}

export async function parseGenericAgent(
  text: string,
  root: string,
  agent: AgentId,
  forced = false,
): Promise<AgentParseResult | null> {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(data)) return null;
  if (!forced && !looksLikeAgent(data, agent)) return null;

  const cwd = cwdOf(data, root);
  const sid = sessionId(data);
  const hints = KIND_HINTS[agent];
  const name = typeof data.hook_event_name === 'string' ? data.hook_event_name : typeof data.event === 'string' ? data.event : '';

  const asPrompt =
    forced && promptOf(data) !== null && filePathOf(data) === null
      ? true
      : Boolean(hints.prompt?.includes(name) || data.kind === 'prompt' || name.toLowerCase().includes('prompt'));
  const asEdit =
    forced && filePathOf(data) !== null
      ? true
      : Boolean(hints.edit?.includes(name) || data.kind === 'edit' || name.toLowerCase().includes('edit') || name.toLowerCase().includes('write'));

  if (asPrompt && !asEdit) {
    const prompt = promptOf(data);
    if (prompt === null) return null;
    return { agent, event: { ...normalizePrompt(agent, sid, prompt), cwd } };
  }

  if (asEdit || filePathOf(data) !== null) {
    const filePath = filePathOf(data);
    if (filePath === null) return null;
    const event = await normalizeEditFromDisk({
      agent,
      sessionId: sid,
      root,
      cwd,
      filePath,
      tool: typeof name === 'string' && name.length > 0 ? name : 'edit',
      input: data.tool_input ?? data.input ?? null,
    });
    return event === null ? null : { agent, event: { ...event, cwd } };
  }

  const prompt = promptOf(data);
  if (prompt !== null) return { agent, event: { ...normalizePrompt(agent, sid, prompt), cwd } };
  return null;
}

export function agentFromExplicitField(data: Record<string, unknown>): AgentId | null {
  const raw = data.agent ?? data.nightowl_agent;
  return typeof raw === 'string' && isAgentId(raw) ? raw : null;
}

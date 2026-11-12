import { cwdOf, eventNameOf, filePathOf, isRecord, promptOf, sessionIdOf } from './fields.js';
import type { AgentId } from './ids.js';
import { isAgentId } from './ids.js';
import { normalizeEditFromDisk, normalizePrompt } from './snapshot.js';
import type { AgentParseResult } from './types.js';

/** Event hints for manual (and legacy) agents still routed through the generic parser. */
const KIND_HINTS: Readonly<Partial<Record<AgentId, { prompt?: readonly string[]; edit?: readonly string[] }>>> = Object.freeze({
  'copilot-workspace': { prompt: ['prompt_submitted', 'UserPromptSubmit'], edit: ['file_changed', 'PostToolUse'] },
  aider: { prompt: ['user_input', 'UserPromptSubmit'], edit: ['file_update', 'after_write', 'PostToolUse'] },
});

export function looksLikeAgent(data: Record<string, unknown>, agent: AgentId): boolean {
  if (data.agent === agent || data.nightowl_agent === agent) return true;
  const hints = KIND_HINTS[agent];
  if (!hints) return false;
  const name = eventNameOf(data);
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
  const sid = sessionIdOf(data);
  const hints = KIND_HINTS[agent] ?? { prompt: [], edit: [] };
  const name = eventNameOf(data);

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
      tool: name.length > 0 ? name : 'edit',
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

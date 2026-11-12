import { cwdOf, eventNameOf, filePathOf, isRecord, promptOf, sessionIdOf } from './fields.js';
import { normalizeEditFromDisk, normalizePrompt } from './snapshot.js';
import type { AgentParseResult } from './types.js';

const PROMPT_EVENTS = Object.freeze(['task_prompt', 'UserPromptSubmit'] as const);
const EDIT_EVENTS = Object.freeze(['file_edited', 'tool_result', 'PostToolUse'] as const);

export function looksLikeCline(data: Record<string, unknown>): boolean {
  if (data.agent === 'cline' || data.nightowl_agent === 'cline') return true;
  const name = eventNameOf(data);
  return (
    (PROMPT_EVENTS.includes(name as (typeof PROMPT_EVENTS)[number]) && promptOf(data) !== null) ||
    (EDIT_EVENTS.includes(name as (typeof EDIT_EVENTS)[number]) && filePathOf(data) !== null)
  );
}

export async function parseCline(text: string, root: string, forced = false): Promise<AgentParseResult | null> {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(data)) return null;
  if (!forced && !looksLikeCline(data)) return null;

  const cwd = cwdOf(data, root);
  const sid = sessionIdOf(data);
  const name = eventNameOf(data);
  const prompt = promptOf(data);
  const filePath = filePathOf(data);

  const asPrompt =
    forced && prompt !== null && filePath === null
      ? true
      : Boolean(PROMPT_EVENTS.includes(name as (typeof PROMPT_EVENTS)[number]) || data.kind === 'prompt');
  const asEdit =
    forced && filePath !== null
      ? true
      : Boolean(EDIT_EVENTS.includes(name as (typeof EDIT_EVENTS)[number]) || data.kind === 'edit');

  if (asPrompt && !asEdit) {
    if (prompt === null) return null;
    return { agent: 'cline', event: { ...normalizePrompt('cline', sid, prompt), cwd } };
  }

  if (asEdit || filePath !== null) {
    if (filePath === null) return null;
    const event = await normalizeEditFromDisk({
      agent: 'cline',
      sessionId: sid,
      root,
      cwd,
      filePath,
      tool: name || 'file_edited',
      input: data.tool_input ?? data.input ?? null,
    });
    return event === null ? null : { agent: 'cline', event: { ...event, cwd } };
  }

  if (prompt !== null) return { agent: 'cline', event: { ...normalizePrompt('cline', sid, prompt), cwd } };
  return null;
}

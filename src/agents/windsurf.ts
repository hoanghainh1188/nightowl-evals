import { cwdOf, eventNameOf, filePathOf, isRecord, promptOf, sessionIdOf } from './fields.js';
import { normalizeEditFromDisk, normalizePrompt } from './snapshot.js';
import type { AgentParseResult } from './types.js';

const PROMPT_EVENTS = Object.freeze(['pre_user_prompt', 'UserPromptSubmit'] as const);
const EDIT_EVENTS = Object.freeze(['post_file_edit', 'after_file_edit', 'PostToolUse'] as const);

export function looksLikeWindsurf(data: Record<string, unknown>): boolean {
  if (data.agent === 'windsurf' || data.nightowl_agent === 'windsurf') return true;
  const name = eventNameOf(data);
  return (
    (PROMPT_EVENTS.includes(name as (typeof PROMPT_EVENTS)[number]) && promptOf(data) !== null) ||
    (EDIT_EVENTS.includes(name as (typeof EDIT_EVENTS)[number]) && filePathOf(data) !== null)
  );
}

export async function parseWindsurf(text: string, root: string, forced = false): Promise<AgentParseResult | null> {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(data)) return null;
  if (!forced && !looksLikeWindsurf(data)) return null;

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
    return { agent: 'windsurf', event: { ...normalizePrompt('windsurf', sid, prompt), cwd } };
  }

  if (asEdit || filePath !== null) {
    if (filePath === null) return null;
    const event = await normalizeEditFromDisk({
      agent: 'windsurf',
      sessionId: sid,
      root,
      cwd,
      filePath,
      tool: name || 'post_file_edit',
      input: data.tool_input ?? data.input ?? null,
    });
    return event === null ? null : { agent: 'windsurf', event: { ...event, cwd } };
  }

  if (prompt !== null) return { agent: 'windsurf', event: { ...normalizePrompt('windsurf', sid, prompt), cwd } };
  return null;
}

import { normalizeEditFromDisk, normalizePrompt } from './snapshot.js';
import type { AgentParseResult } from './types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sessionId(data: Record<string, unknown>): string | null {
  if (typeof data.conversation_id === 'string') return data.conversation_id;
  if (typeof data.session_id === 'string') return data.session_id;
  return null;
}

function cwdOf(data: Record<string, unknown>): string | null {
  if (typeof data.cwd === 'string') return data.cwd;
  if (typeof data.workspace_roots === 'object' && Array.isArray(data.workspace_roots) && typeof data.workspace_roots[0] === 'string') {
    return data.workspace_roots[0];
  }
  return null;
}

export function looksLikeCursor(data: Record<string, unknown>): boolean {
  const name = data.hook_event_name;
  return name === 'beforeSubmitPrompt' || name === 'afterFileEdit';
}

export async function parseCursor(text: string, root: string): Promise<AgentParseResult | null> {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(data) || !looksLikeCursor(data)) return null;
  const cwd = cwdOf(data) ?? root;
  const sid = sessionId(data);

  if (data.hook_event_name === 'beforeSubmitPrompt') {
    const prompt = typeof data.prompt === 'string' ? data.prompt : typeof data.text === 'string' ? data.text : null;
    if (prompt === null) return null;
    return { agent: 'cursor', event: { ...normalizePrompt('cursor', sid, prompt), cwd } };
  }

  if (data.hook_event_name === 'afterFileEdit') {
    const filePath =
      typeof data.file_path === 'string'
        ? data.file_path
        : typeof data.filePath === 'string'
          ? data.filePath
          : null;
    if (filePath === null) return null;
    const event = await normalizeEditFromDisk({
      agent: 'cursor',
      sessionId: sid,
      root,
      cwd,
      filePath,
      tool: 'afterFileEdit',
      input: { edits: data.edits ?? null },
    });
    return event === null ? null : { agent: 'cursor', event: { ...event, cwd } };
  }

  return null;
}

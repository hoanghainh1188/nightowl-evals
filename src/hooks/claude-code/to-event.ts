import type { NewEvent } from '../../storage/events.js';
import { parseClaudeCode } from '../../agents/claude-code.js';
import type { HookPayload } from './payload.js';

export { MAX_PROMPT_BYTES, MAX_SNAPSHOT_BYTES } from '../../agents/snapshot.js';

// Keeps the Claude Code path; maps into the multi-agent NewEvent shape.
export async function toEvent(payload: HookPayload, root: string): Promise<NewEvent | null> {
  const text = JSON.stringify(
    payload.event === 'UserPromptSubmit'
      ? {
          hook_event_name: 'UserPromptSubmit',
          prompt: payload.prompt,
          session_id: payload.sessionId,
          cwd: payload.cwd,
        }
      : {
          hook_event_name: 'PostToolUse',
          tool_name: payload.toolName,
          tool_input: payload.toolInput,
          session_id: payload.sessionId,
          cwd: payload.cwd,
        },
  );
  const parsed = await parseClaudeCode(text, root);
  if (parsed === null) return null;
  return {
    source: parsed.event.source,
    kind: parsed.event.kind,
    sessionId: parsed.event.sessionId,
    filePath: parsed.event.filePath,
    payload: parsed.event.payload,
    agent: parsed.event.agent,
  };
}

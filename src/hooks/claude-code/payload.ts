export type HookPayload =
  | {
      readonly event: 'UserPromptSubmit';
      readonly sessionId: string | null;
      readonly cwd: string;
      readonly prompt: string;
    }
  | {
      readonly event: 'PostToolUse';
      readonly sessionId: string | null;
      readonly cwd: string;
      readonly toolName: string;
      readonly toolInput: Readonly<Record<string, unknown>>;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Validates only the fields NightOwl uses; anything unexpected yields null.
export function parseHookPayload(text: string): HookPayload | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(data) || typeof data.cwd !== 'string') return null;
  const sessionId = typeof data.session_id === 'string' ? data.session_id : null;

  if (data.hook_event_name === 'UserPromptSubmit' && typeof data.prompt === 'string') {
    return { event: 'UserPromptSubmit', sessionId, cwd: data.cwd, prompt: data.prompt };
  }
  if (data.hook_event_name === 'PostToolUse' && typeof data.tool_name === 'string' && isRecord(data.tool_input)) {
    return { event: 'PostToolUse', sessionId, cwd: data.cwd, toolName: data.tool_name, toolInput: data.tool_input };
  }
  return null;
}

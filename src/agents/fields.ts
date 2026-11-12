/** Shared JSON field helpers for agent payload contracts. */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function sessionIdOf(data: Record<string, unknown>): string | null {
  for (const key of ['session_id', 'conversation_id', 'thread_id', 'chat_id'] as const) {
    if (typeof data[key] === 'string') return data[key];
  }
  return null;
}

export function cwdOf(data: Record<string, unknown>, fallback: string): string {
  return typeof data.cwd === 'string' ? data.cwd : fallback;
}

export function filePathOf(data: Record<string, unknown>): string | null {
  for (const key of ['file_path', 'filePath', 'path'] as const) {
    if (typeof data[key] === 'string') return data[key];
  }
  return null;
}

export function promptOf(data: Record<string, unknown>): string | null {
  for (const key of ['prompt', 'text', 'message', 'user_message'] as const) {
    if (typeof data[key] === 'string') return data[key];
  }
  return null;
}

export function eventNameOf(data: Record<string, unknown>): string {
  if (typeof data.hook_event_name === 'string') return data.hook_event_name;
  if (typeof data.event === 'string') return data.event;
  return '';
}

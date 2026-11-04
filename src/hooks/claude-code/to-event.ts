import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { NewEvent } from '../../storage/events.js';
import type { HookPayload } from './payload.js';
import { projectRelativePath } from './paths.js';

export const MAX_PROMPT_BYTES = 64 * 1024;
export const MAX_SNAPSHOT_BYTES = 512 * 1024;
const MAX_INPUT_BYTES = 512 * 1024;
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit']);

type SnapshotSkip = 'too_large' | 'unreadable';

function truncateUtf8(text: string, maxBytes: number): { text: string; truncated: boolean } {
  const bytes = Buffer.from(text, 'utf8');
  if (bytes.length <= maxBytes) return { text, truncated: false };
  let end = maxBytes;
  // Step back over UTF-8 continuation bytes so no character is cut in half.
  while (end > 0 && ((bytes[end] ?? 0) & 0xc0) === 0x80) end -= 1;
  return { text: bytes.subarray(0, end).toString('utf8'), truncated: true };
}

async function readSnapshot(path: string): Promise<{ snapshot: string | null; snapshot_skipped: SnapshotSkip | null }> {
  try {
    const info = await stat(path);
    if (!info.isFile()) return { snapshot: null, snapshot_skipped: 'unreadable' };
    if (info.size > MAX_SNAPSHOT_BYTES) return { snapshot: null, snapshot_skipped: 'too_large' };
    return { snapshot: await readFile(path, 'utf8'), snapshot_skipped: null };
  } catch {
    return { snapshot: null, snapshot_skipped: 'unreadable' };
  }
}

function pickInput(tool: string, input: Readonly<Record<string, unknown>>): unknown {
  const picked =
    tool === 'Write'
      ? { content_length: typeof input.content === 'string' ? input.content.length : null }
      : tool === 'MultiEdit'
        ? { edits: input.edits }
        : { old_string: input.old_string, new_string: input.new_string, replace_all: input.replace_all };
  return Buffer.byteLength(JSON.stringify(picked)) > MAX_INPUT_BYTES ? { skipped: 'too_large' } : picked;
}

export async function toEvent(payload: HookPayload, root: string): Promise<NewEvent | null> {
  if (payload.event === 'UserPromptSubmit') {
    const { text, truncated } = truncateUtf8(payload.prompt, MAX_PROMPT_BYTES);
    return { source: 'claude-code', kind: 'prompt', sessionId: payload.sessionId, filePath: null, payload: { prompt: text, truncated } };
  }

  if (!EDIT_TOOLS.has(payload.toolName)) return null;
  const filePath = payload.toolInput.file_path;
  if (typeof filePath !== 'string') return null;
  const relativePath = await projectRelativePath(root, payload.cwd, filePath);
  if (relativePath === null) return null;

  return {
    source: 'claude-code',
    kind: 'edit',
    sessionId: payload.sessionId,
    filePath: relativePath,
    payload: {
      tool: payload.toolName,
      input: pickInput(payload.toolName, payload.toolInput),
      ...(await readSnapshot(join(root, relativePath))),
    },
  };
}

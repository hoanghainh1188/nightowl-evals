import { parseHookPayload } from '../hooks/claude-code/payload.js';
import { MAX_PROMPT_BYTES, contentSkipReason, normalizePrompt, readFileSnapshot } from './snapshot.js';
import type { AgentParseResult } from './types.js';
import { truncateUtf8 } from '../shared/truncate.js';
import { join } from 'node:path';
import { containsInlineSecret } from '../hooks/claude-code/sensitive.js';
import { projectRelativePath } from '../hooks/claude-code/paths.js';

const MAX_INPUT_BYTES = 512 * 1024;
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit']);

function hasSecretInInput(tool: string, input: Readonly<Record<string, unknown>>): boolean {
  if (tool === 'Write') {
    return typeof input.content === 'string' && containsInlineSecret(input.content);
  }
  if (tool === 'MultiEdit') {
    return (
      Array.isArray(input.edits) &&
      input.edits.some(
        (e: Record<string, unknown>) =>
          (typeof e?.old_string === 'string' && containsInlineSecret(e.old_string)) ||
          (typeof e?.new_string === 'string' && containsInlineSecret(e.new_string)),
      )
    );
  }
  return (
    (typeof input.old_string === 'string' && containsInlineSecret(input.old_string)) ||
    (typeof input.new_string === 'string' && containsInlineSecret(input.new_string))
  );
}

function pickInput(tool: string, input: Readonly<Record<string, unknown>>): unknown {
  if (hasSecretInInput(tool, input)) return { skipped: 'contains_secret' };
  const picked =
    tool === 'Write'
      ? { content_length: typeof input.content === 'string' ? input.content.length : null }
      : tool === 'MultiEdit'
        ? { edits: input.edits }
        : { old_string: input.old_string, new_string: input.new_string, replace_all: input.replace_all };
  return Buffer.byteLength(JSON.stringify(picked)) > MAX_INPUT_BYTES ? { skipped: 'too_large' } : picked;
}

export function looksLikeClaudeCode(data: Record<string, unknown>): boolean {
  return data.hook_event_name === 'UserPromptSubmit' || data.hook_event_name === 'PostToolUse';
}

export async function parseClaudeCode(text: string, root: string): Promise<AgentParseResult | null> {
  const payload = parseHookPayload(text);
  if (payload === null) return null;

  if (payload.event === 'UserPromptSubmit') {
    // Keep truncate path identical to legacy to-event for existing tests.
    const { text: prompt, truncated } = truncateUtf8(payload.prompt, MAX_PROMPT_BYTES);
    return {
      agent: 'claude-code',
      event: {
        agent: 'claude-code',
        source: 'agent-hook',
        kind: 'prompt',
        sessionId: payload.sessionId,
        filePath: null,
        payload: { prompt, truncated },
        cwd: payload.cwd,
      },
    };
  }

  if (!EDIT_TOOLS.has(payload.toolName)) return null;
  const filePath = payload.toolInput.file_path;
  if (typeof filePath !== 'string') return null;
  const relativePath = await projectRelativePath(root, payload.cwd, filePath);
  if (relativePath === null) return null;

  const base = {
    agent: 'claude-code' as const,
    source: 'agent-hook' as const,
    kind: 'edit' as const,
    sessionId: payload.sessionId,
    filePath: relativePath,
    cwd: payload.cwd,
  };
  const skip = await contentSkipReason(root, relativePath);
  if (skip !== null) {
    return {
      agent: 'claude-code',
      event: {
        ...base,
        payload: { tool: payload.toolName, input: { skipped: skip }, snapshot: null, snapshot_skipped: skip },
      },
    };
  }
  return {
    agent: 'claude-code',
    event: {
      ...base,
      payload: {
        tool: payload.toolName,
        input: pickInput(payload.toolName, payload.toolInput),
        ...(await readFileSnapshot(join(root, relativePath))),
      },
    },
  };
}

// Re-export for callers that only need a prompt without file IO.
export { normalizePrompt };

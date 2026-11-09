import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { join } from 'node:path';
import type { NewEvent } from '../../storage/events.js';
import { runGit } from '../git/run-git.js';
import type { HookPayload } from './payload.js';
import { projectRelativePath } from './paths.js';
import { containsInlineSecret, isSensitivePath } from './sensitive.js';
import { truncateUtf8 } from '../../shared/truncate.js';

export const MAX_PROMPT_BYTES = 64 * 1024;
export const MAX_SNAPSHOT_BYTES = 512 * 1024;
const MAX_INPUT_BYTES = 512 * 1024;
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit']);
const CHECK_IGNORE_TIMEOUT_MS = 300;

type SnapshotSkip = 'too_large' | 'unreadable' | 'sensitive' | 'ignored' | 'contains_secret';

async function readSnapshot(path: string): Promise<{ snapshot: string | null; snapshot_skipped: SnapshotSkip | null }> {
  // O_NOFOLLOW: if the file was swapped for a symlink after the path check, refuse it.
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW).catch(() => null);
  if (handle === null) return { snapshot: null, snapshot_skipped: 'unreadable' };
  try {
    const info = await handle.stat();
    if (!info.isFile()) return { snapshot: null, snapshot_skipped: 'unreadable' };
    if (info.size > MAX_SNAPSHOT_BYTES) return { snapshot: null, snapshot_skipped: 'too_large' };
    const content = await handle.readFile('utf8');
    if (containsInlineSecret(content)) return { snapshot: null, snapshot_skipped: 'contains_secret' };
    return { snapshot: content, snapshot_skipped: null };
  } catch {
    return { snapshot: null, snapshot_skipped: 'unreadable' };
  } finally {
    await handle.close();
  }
}

// Files git ignores never get versioned (and are often local secrets): store no content.
async function isGitIgnored(root: string, relativePath: string): Promise<boolean> {
  try {
    await runGit(['check-ignore', '-q', '--', relativePath], { cwd: root, timeoutMs: CHECK_IGNORE_TIMEOUT_MS });
    return true;
  } catch {
    return false; // exit 1 = not ignored; anything else (no git, timeout) = assume not
  }
}

async function contentSkipReason(root: string, relativePath: string): Promise<SnapshotSkip | null> {
  if (isSensitivePath(relativePath)) return 'sensitive';
  return (await isGitIgnored(root, relativePath)) ? 'ignored' : null;
}

function hasSecretInInput(tool: string, input: Readonly<Record<string, unknown>>): boolean {
  if (tool === 'Write') {
    return typeof input.content === 'string' && containsInlineSecret(input.content);
  }
  if (tool === 'MultiEdit') {
    return Array.isArray(input.edits) && input.edits.some((e: Record<string, unknown>) =>
      (typeof e?.old_string === 'string' && containsInlineSecret(e.old_string)) ||
      (typeof e?.new_string === 'string' && containsInlineSecret(e.new_string)),
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

  const base = { source: 'claude-code', kind: 'edit', sessionId: payload.sessionId, filePath: relativePath } as const;
  const skip = await contentSkipReason(root, relativePath);
  if (skip !== null) {
    return { ...base, payload: { tool: payload.toolName, input: { skipped: skip }, snapshot: null, snapshot_skipped: skip } };
  }
  return {
    ...base,
    payload: {
      tool: payload.toolName,
      input: pickInput(payload.toolName, payload.toolInput),
      ...(await readSnapshot(join(root, relativePath))),
    },
  };
}

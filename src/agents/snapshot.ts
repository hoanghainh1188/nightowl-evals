import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { join } from 'node:path';
import { projectRelativePath } from '../hooks/claude-code/paths.js';
import { containsInlineSecret, isSensitivePath } from '../hooks/claude-code/sensitive.js';
import { runGit } from '../hooks/git/run-git.js';
import { truncateUtf8 } from '../shared/truncate.js';
import type { AgentId } from './ids.js';
import type { NormalizedEvent } from './types.js';

export const MAX_PROMPT_BYTES = 64 * 1024;
export const MAX_SNAPSHOT_BYTES = 512 * 1024;
export const MAX_INPUT_BYTES = 512 * 1024;
const CHECK_IGNORE_TIMEOUT_MS = 300;

function valueContainsSecret(value: unknown): boolean {
  if (typeof value === 'string') return containsInlineSecret(value);
  if (Array.isArray(value)) return value.some(valueContainsSecret);
  if (typeof value === 'object' && value !== null) {
    return Object.values(value as Record<string, unknown>).some(valueContainsSecret);
  }
  return false;
}

/** Strip secrets and oversized tool metadata before it hits SQLite. */
export function sanitizeHookInput(input: unknown): unknown {
  if (input === null || input === undefined) return null;
  if (valueContainsSecret(input)) return { skipped: 'contains_secret' };
  try {
    if (Buffer.byteLength(JSON.stringify(input)) > MAX_INPUT_BYTES) return { skipped: 'too_large' };
  } catch {
    return { skipped: 'unreadable' };
  }
  return input;
}

export type SnapshotSkip = 'too_large' | 'unreadable' | 'sensitive' | 'ignored' | 'contains_secret';

export async function readFileSnapshot(
  path: string,
): Promise<{ snapshot: string | null; snapshot_skipped: SnapshotSkip | null }> {
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

async function isGitIgnored(root: string, relativePath: string): Promise<boolean> {
  try {
    await runGit(['check-ignore', '-q', '--', relativePath], { cwd: root, timeoutMs: CHECK_IGNORE_TIMEOUT_MS });
    return true;
  } catch {
    return false;
  }
}

export async function contentSkipReason(root: string, relativePath: string): Promise<SnapshotSkip | null> {
  if (isSensitivePath(relativePath)) return 'sensitive';
  return (await isGitIgnored(root, relativePath)) ? 'ignored' : null;
}

export function normalizePrompt(agent: AgentId, sessionId: string | null, prompt: string): NormalizedEvent {
  const { text, truncated } = truncateUtf8(prompt, MAX_PROMPT_BYTES);
  return {
    agent,
    source: 'agent-hook',
    kind: 'prompt',
    sessionId,
    filePath: null,
    payload: { prompt: text, truncated },
  };
}

export async function normalizeEditFromDisk(options: {
  readonly agent: AgentId;
  readonly sessionId: string | null;
  readonly root: string;
  readonly cwd: string;
  readonly filePath: string;
  readonly tool?: string;
  readonly input?: unknown;
}): Promise<NormalizedEvent | null> {
  const relativePath = await projectRelativePath(options.root, options.cwd, options.filePath);
  if (relativePath === null) return null;
  const base = {
    agent: options.agent,
    source: 'agent-hook' as const,
    kind: 'edit' as const,
    sessionId: options.sessionId,
    filePath: relativePath,
  };
  const input = sanitizeHookInput(options.input);
  const skip = await contentSkipReason(options.root, relativePath);
  if (skip !== null) {
    return {
      ...base,
      payload: {
        tool: options.tool ?? 'edit',
        input: input ?? { skipped: skip },
        snapshot: null,
        snapshot_skipped: skip,
      },
    };
  }
  return {
    ...base,
    payload: {
      tool: options.tool ?? 'edit',
      input,
      ...(await readFileSnapshot(join(options.root, relativePath))),
    },
  };
}

import type { StdinRead } from '../../cli/io.js';
import { findProjectRoot } from '../../storage/project-root.js';
import { openStore } from '../../storage/store.js';
import { appendErrorLog } from '../error-log.js';
import { parseHookPayload } from './payload.js';
import { toEvent } from './to-event.js';

const HOOK_NAME = 'log';

// Stores one Claude Code hook event. Never throws; problems go to .nightowl/nightowl.log.
export async function recordClaudeCodeEvent(input: StdinRead, fallbackCwd: string): Promise<void> {
  const payload = input.complete ? parseHookPayload(input.text) : null;
  const root = findProjectRoot(payload?.cwd ?? fallbackCwd);
  if (root === null) return;
  if (payload === null) {
    const reason = input.complete ? 'invalid or unsupported hook payload' : 'stdin did not close in time; event dropped';
    await appendErrorLog(root, HOOK_NAME, reason);
    return;
  }
  try {
    const event = await toEvent(payload, root);
    if (event === null) return;
    const store = await openStore({ cwd: root });
    try {
      store.insertEvent(event);
    } finally {
      store.close();
    }
  } catch (error) {
    await appendErrorLog(root, HOOK_NAME, error);
  }
}

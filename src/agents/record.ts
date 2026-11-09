import type { StdinRead } from '../cli/io.js';
import { appendErrorLog } from '../hooks/error-log.js';
import type { NewEvent } from '../storage/events.js';
import { findProjectRoot } from '../storage/project-root.js';
import { openStore } from '../storage/store.js';
import { detectAndParse, rejectUnknownAgent } from './detect.js';
import type { NormalizedEvent } from './types.js';

const HOOK_NAME = 'log';

export function toNewEvent(event: NormalizedEvent): NewEvent {
  return {
    source: event.source,
    kind: event.kind,
    sessionId: event.sessionId,
    filePath: event.filePath,
    payload: event.payload,
    agent: event.agent,
  };
}

export interface RecordOptions {
  readonly forcedAgent?: string | null;
}

// Stores one agent hook event. Never throws; problems go to .nightowl/nightowl.log.
export async function recordAgentEvent(
  input: StdinRead,
  fallbackCwd: string,
  options: RecordOptions = {},
): Promise<void> {
  if (rejectUnknownAgent(options.forcedAgent)) {
    const root = findProjectRoot(fallbackCwd);
    if (root !== null) await appendErrorLog(root, HOOK_NAME, `unsupported agent id: ${options.forcedAgent}`);
    return;
  }

  let dataCwd: string | undefined;
  if (input.complete) {
    try {
      const parsed = JSON.parse(input.text) as { cwd?: unknown };
      if (typeof parsed.cwd === 'string') dataCwd = parsed.cwd;
    } catch {
      // detectAndParse handles invalid JSON below.
    }
  }

  const root = findProjectRoot(dataCwd ?? fallbackCwd);
  if (root === null) return;
  if (!input.complete) {
    await appendErrorLog(root, HOOK_NAME, 'stdin did not close in time; event dropped');
    return;
  }

  try {
    const parsed = await detectAndParse(input.text, root, options.forcedAgent);
    if (parsed === null) {
      await appendErrorLog(root, HOOK_NAME, 'invalid or unsupported hook payload');
      return;
    }
    const store = await openStore({ cwd: root });
    try {
      store.insertEvent(toNewEvent(parsed.event));
    } finally {
      store.close();
    }
  } catch (error) {
    await appendErrorLog(root, HOOK_NAME, error);
  }
}

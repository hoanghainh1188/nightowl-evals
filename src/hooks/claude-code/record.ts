import type { StdinRead } from '../../cli/io.js';
import { recordAgentEvent } from '../../agents/record.js';

// Stores one Claude Code hook event. Never throws; problems go to .nightowl/nightowl.log.
export async function recordClaudeCodeEvent(input: StdinRead, fallbackCwd: string): Promise<void> {
  await recordAgentEvent(input, fallbackCwd, { forcedAgent: 'claude-code' });
}

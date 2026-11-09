import { looksLikeClaudeCode, parseClaudeCode } from './claude-code.js';
import { looksLikeCursor, parseCursor } from './cursor.js';
import { agentFromExplicitField, parseGenericAgent } from './generic.js';
import type { AgentId } from './ids.js';
import { isAgentId, parseAgentId } from './ids.js';
import type { AgentParseResult } from './types.js';

const GENERIC_ORDER: readonly AgentId[] = Object.freeze([
  'windsurf',
  'cline',
  'roo',
  'copilot-workspace',
  'aider',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function detectAndParse(
  text: string,
  root: string,
  forcedAgent?: string | null,
): Promise<AgentParseResult | null> {
  if (forcedAgent !== undefined && forcedAgent !== null) {
    const id = parseAgentId(forcedAgent);
    if (id === null) return null;
    if (id === 'claude-code') return parseClaudeCode(text, root);
    if (id === 'cursor') return parseCursor(text, root);
    return parseGenericAgent(text, root, id, true);
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(data)) return null;

  const explicit = agentFromExplicitField(data);
  if (explicit !== null) {
    if (explicit === 'claude-code') return parseClaudeCode(text, root);
    if (explicit === 'cursor') return parseCursor(text, root);
    return parseGenericAgent(text, root, explicit, true);
  }

  if (looksLikeClaudeCode(data)) return parseClaudeCode(text, root);
  if (looksLikeCursor(data)) return parseCursor(text, root);

  for (const agent of GENERIC_ORDER) {
    const parsed = await parseGenericAgent(text, root, agent, false);
    if (parsed !== null) return parsed;
  }
  return null;
}

export function rejectUnknownAgent(forcedAgent: string | null | undefined): boolean {
  return forcedAgent !== undefined && forcedAgent !== null && !isAgentId(forcedAgent);
}

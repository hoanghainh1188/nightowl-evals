import { looksLikeClaudeCode, parseClaudeCode } from './claude-code.js';
import { looksLikeCline, parseCline } from './cline.js';
import { looksLikeCursor, parseCursor } from './cursor.js';
import { agentFromExplicitField, parseGenericAgent } from './generic.js';
import { isRecord } from './fields.js';
import type { AgentId } from './ids.js';
import { isAgentId, parseAgentId } from './ids.js';
import { looksLikeRoo, parseRoo } from './roo.js';
import type { AgentParseResult } from './types.js';
import { looksLikeWindsurf, parseWindsurf } from './windsurf.js';

type DedicatedParser = (text: string, root: string, forced?: boolean) => Promise<AgentParseResult | null>;

const DEDICATED: Readonly<Partial<Record<AgentId, DedicatedParser>>> = Object.freeze({
  'claude-code': (text, root) => parseClaudeCode(text, root),
  cursor: (text, root) => parseCursor(text, root),
  windsurf: parseWindsurf,
  cline: parseCline,
  roo: parseRoo,
});

/** Auto-detect order for best-effort dedicated adapters (after Claude/Cursor/explicit). */
const BEST_EFFORT_DETECT: readonly { id: AgentId; looks: (data: Record<string, unknown>) => boolean; parse: DedicatedParser }[] =
  Object.freeze([
    { id: 'windsurf', looks: looksLikeWindsurf, parse: parseWindsurf },
    { id: 'cline', looks: looksLikeCline, parse: parseCline },
    { id: 'roo', looks: looksLikeRoo, parse: parseRoo },
  ]);

async function parseById(id: AgentId, text: string, root: string, forced: boolean): Promise<AgentParseResult | null> {
  const dedicated = DEDICATED[id];
  if (dedicated) return dedicated(text, root, forced);
  return parseGenericAgent(text, root, id, forced);
}

export async function detectAndParse(
  text: string,
  root: string,
  forcedAgent?: string | null,
): Promise<AgentParseResult | null> {
  if (forcedAgent !== undefined && forcedAgent !== null) {
    const id = parseAgentId(forcedAgent);
    if (id === null) return null;
    return parseById(id, text, root, true);
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(data)) return null;

  const explicit = agentFromExplicitField(data);
  if (explicit !== null) return parseById(explicit, text, root, true);

  if (looksLikeClaudeCode(data)) return parseClaudeCode(text, root);
  if (looksLikeCursor(data)) return parseCursor(text, root);

  for (const entry of BEST_EFFORT_DETECT) {
    if (!entry.looks(data)) continue;
    const parsed = await entry.parse(text, root, false);
    if (parsed !== null) return parsed;
  }
  return null;
}

export function rejectUnknownAgent(forcedAgent: string | null | undefined): boolean {
  return forcedAgent !== undefined && forcedAgent !== null && !isAgentId(forcedAgent);
}

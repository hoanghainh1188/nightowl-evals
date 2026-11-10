// Supported coding agents. `unknown` is only for git-fallback metadata, not hook ingest.
export const AGENT_IDS = Object.freeze([
  'claude-code',
  'cursor',
  'windsurf',
  'cline',
  'roo',
  'copilot-workspace',
  'aider',
] as const);

export type AgentId = (typeof AGENT_IDS)[number];

export const FALLBACK_AGENT = 'unknown' as const;
export type FallbackAgentId = typeof FALLBACK_AGENT;

export type AnyAgentId = AgentId | FallbackAgentId;

/** How well NightOwl can install + ingest for an agent. */
export type AgentMaturity = 'verified' | 'best-effort' | 'manual';

export const AGENT_MATURITY: Readonly<Record<AgentId, AgentMaturity>> = Object.freeze({
  'claude-code': 'verified',
  cursor: 'verified',
  windsurf: 'best-effort',
  cline: 'best-effort',
  roo: 'best-effort',
  'copilot-workspace': 'manual',
  aider: 'manual',
});

const SUPPORTED = new Set<string>(AGENT_IDS);
const ALL = new Set<string>([...AGENT_IDS, FALLBACK_AGENT]);

export function isAgentId(value: string): value is AgentId {
  return SUPPORTED.has(value);
}

export function isAnyAgentId(value: string): value is AnyAgentId {
  return ALL.has(value);
}

export function parseAgentId(value: string): AgentId | null {
  return isAgentId(value) ? value : null;
}

export function maturityOf(agent: AgentId): AgentMaturity {
  return AGENT_MATURITY[agent];
}

export function agentsWithMaturity(maturity: AgentMaturity): readonly AgentId[] {
  return AGENT_IDS.filter((id) => AGENT_MATURITY[id] === maturity);
}

import type { AgentId, AnyAgentId } from './ids.js';

export type EventChannel = 'agent-hook' | 'git';

export interface NormalizedEvent {
  readonly agent: AnyAgentId | null;
  readonly source: EventChannel;
  readonly kind: 'prompt' | 'edit' | string;
  readonly sessionId: string | null;
  readonly filePath: string | null;
  readonly payload: unknown;
  readonly cwd?: string;
}

export interface AgentParseResult {
  readonly agent: AgentId;
  readonly event: NormalizedEvent;
}

import { describe, expect, it } from 'vitest';
import {
  AGENT_IDS,
  AGENT_MATURITY,
  agentsWithMaturity,
  isAgentId,
  maturityOf,
  parseAgentId,
} from '../../src/agents/ids.js';
import { rejectUnknownAgent } from '../../src/agents/detect.js';

describe('agent ids', () => {
  it('accepts known agents and rejects strangers', () => {
    expect(isAgentId('cursor')).toBe(true);
    expect(isAgentId('unknown-bot')).toBe(false);
    expect(parseAgentId('aider')).toBe('aider');
    expect(parseAgentId('unknown-bot')).toBeNull();
    expect(rejectUnknownAgent('unknown-bot')).toBe(true);
    expect(rejectUnknownAgent('cursor')).toBe(false);
    expect(rejectUnknownAgent(null)).toBe(false);
  });

  it('maps maturity for every agent id; Claude and Cursor are verified', () => {
    for (const id of AGENT_IDS) {
      expect(AGENT_MATURITY[id]).toBe(maturityOf(id));
      expect(['verified', 'best-effort', 'manual']).toContain(maturityOf(id));
    }
    expect(maturityOf('claude-code')).toBe('verified');
    expect(maturityOf('cursor')).toBe('verified');
    expect(agentsWithMaturity('verified')).toEqual(['claude-code', 'cursor']);
    expect(agentsWithMaturity('manual')).toEqual(['copilot-workspace', 'aider']);
  });
});

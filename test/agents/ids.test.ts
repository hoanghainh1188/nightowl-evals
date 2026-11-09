import { describe, expect, it } from 'vitest';
import { isAgentId, parseAgentId } from '../../src/agents/ids.js';
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
});

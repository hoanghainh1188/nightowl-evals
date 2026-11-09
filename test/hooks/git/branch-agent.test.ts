import { describe, expect, it } from 'vitest';
import { agentFromBranchName } from '../../../src/hooks/git/branch-agent.js';

describe('agentFromBranchName', () => {
  it.each([
    ['cursor/fix-login', 'cursor'],
    ['feature/cursor/more', 'cursor'],
    ['claude-code/refactor', 'claude-code'],
    ['windsurf/ui', 'windsurf'],
    ['agent/aider/task', 'aider'],
    ['main', 'unknown'],
    ['random/branch', 'unknown'],
  ])('%s → %s', (branch, agent) => {
    expect(agentFromBranchName(branch)).toBe(agent);
  });
});

import type { AnyAgentId } from '../../agents/ids.js';
import { FALLBACK_AGENT, isAgentId } from '../../agents/ids.js';
import { runGit } from './run-git.js';

// Documented branch → agent patterns (prefix or contains). First match wins.
export const BRANCH_AGENT_PATTERNS: ReadonlyArray<{ readonly pattern: RegExp; readonly agent: AnyAgentId }> =
  Object.freeze([
    { pattern: /(^|\/)cursor(\/|$)/i, agent: 'cursor' },
    { pattern: /(^|\/)claude(-code)?(\/|$)/i, agent: 'claude-code' },
    { pattern: /(^|\/)windsurf(\/|$)/i, agent: 'windsurf' },
    { pattern: /(^|\/)cline(\/|$)/i, agent: 'cline' },
    { pattern: /(^|\/)roo(\/|$)/i, agent: 'roo' },
    { pattern: /(^|\/)(copilot|copilot-workspace)(\/|$)/i, agent: 'copilot-workspace' },
    { pattern: /(^|\/)aider(\/|$)/i, agent: 'aider' },
    { pattern: /^agent\/([a-z0-9-]+)\//i, agent: FALLBACK_AGENT }, // resolved below
  ]);

export function agentFromBranchName(branch: string): AnyAgentId {
  const agentSlash = /^agent\/([a-z0-9-]+)\//i.exec(branch);
  if (agentSlash !== null && isAgentId(agentSlash[1]!)) return agentSlash[1]!;
  for (const { pattern, agent } of BRANCH_AGENT_PATTERNS) {
    if (agent === FALLBACK_AGENT) continue;
    if (pattern.test(branch)) return agent;
  }
  return FALLBACK_AGENT;
}

export async function currentBranchAgent(root: string, timeoutMs: number): Promise<AnyAgentId> {
  try {
    const branch = (await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root, timeoutMs })).toString('utf8').trim();
    if (branch === '' || branch === 'HEAD') return FALLBACK_AGENT;
    return agentFromBranchName(branch);
  } catch {
    return FALLBACK_AGENT;
  }
}

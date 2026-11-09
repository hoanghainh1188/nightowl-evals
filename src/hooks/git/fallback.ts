import type { Store } from '../../storage/store.js';
import { currentBranchAgent } from './branch-agent.js';

// Observation-only: never invents ai_content / never creates failures.
export async function recordUnattributedChanges(
  store: Store,
  root: string,
  filePaths: readonly string[],
  remainingMs: () => number,
): Promise<number> {
  if (filePaths.length === 0) return 0;
  const agent = await currentBranchAgent(root, remainingMs());
  let written = 0;
  for (const filePath of filePaths) {
    if (remainingMs() <= 0) break;
    store.insertEvent({
      source: 'git',
      kind: 'unattributed-change',
      sessionId: null,
      filePath,
      agent,
      payload: {
        reason: 'no_agent_snapshot',
        source: 'git-fallback',
        inferred_agent: agent,
      },
    });
    written += 1;
  }
  return written;
}

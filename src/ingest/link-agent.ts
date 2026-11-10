import type { AnyAgentId } from '../agents/ids.js';
import type { Store } from '../storage/store.js';

export interface AgentLink {
  readonly agent: AnyAgentId | null;
  readonly relatedEventId: number | null;
}

/** Best-effort: prefer open unchecked edits for the file, else null. Does not invent failures. */
export function linkAgentForFile(store: Store, filePath: string | null): AgentLink {
  if (filePath === null || filePath.length === 0) return { agent: null, relatedEventId: null };
  const open = store.listOpenEdits(filePath);
  if (open.length > 0) {
    const latest = open[open.length - 1]!;
    return { agent: latest.agent, relatedEventId: latest.id };
  }
  const unchecked = store.listUncheckedEdits([filePath]);
  if (unchecked.length > 0) {
    const latest = unchecked[unchecked.length - 1]!;
    return { agent: latest.agent, relatedEventId: latest.id };
  }
  return { agent: null, relatedEventId: null };
}

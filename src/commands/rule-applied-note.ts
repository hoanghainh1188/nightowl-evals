import { printable } from '../shared/printable.js';
import { openExistingStore } from './existing-store.js';

/** One-line rule-applied annotation for eval A/B reports (read-only; never calls network). */
export async function ruleAppliedNote(cwd: string): Promise<string> {
  const store = await openExistingStore(cwd);
  if (typeof store === 'string') return 'Rule applied: none recorded';
  try {
    const mark = store.getLatestRuleApplication();
    if (mark === null) return 'Rule applied: none recorded';
    return `Rule applied: ${printable(mark.label)} at ${mark.appliedAt} (see nightowl rule-impact for failure deltas)`;
  } catch {
    return 'Rule applied: n/a';
  } finally {
    store.close();
  }
}

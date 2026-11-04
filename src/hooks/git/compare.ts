export interface Comparison {
  readonly outcome: 'unchanged' | 'modified';
  readonly lines_added: number;
  readonly lines_removed: number;
  readonly whitespace_only: boolean;
}

function countLines(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const line of text.split('\n')) counts.set(line, (counts.get(line) ?? 0) + 1);
  return counts;
}

function surplus(from: Map<string, number>, other: Map<string, number>): number {
  let total = 0;
  for (const [line, count] of from) total += Math.max(0, count - (other.get(line) ?? 0));
  return total;
}

// Approximate line diff: lines present in one version but not the other, counted as a
// multiset. Enough to flag edits; an exact diff is left to failure records.
export function compareContent(ai: string, staged: string): Comparison {
  if (ai === staged) return { outcome: 'unchanged', lines_added: 0, lines_removed: 0, whitespace_only: false };
  const before = countLines(ai);
  const after = countLines(staged);
  return {
    outcome: 'modified',
    lines_added: surplus(after, before),
    lines_removed: surplus(before, after),
    whitespace_only: ai.replace(/\s+/g, '') === staged.replace(/\s+/g, ''),
  };
}

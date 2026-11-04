// Fixed at one half: `pass` below is computed exactly as 2 × hits × misses ≥ totals.
export const PASS_SCORE = 0.5;

export interface Score {
  // Share of the lines the developer added that the output also has.
  readonly coverage: number;
  // Share of the lines the developer removed that the output still has.
  readonly repeat: number;
  readonly score: number;
  readonly pass: boolean;
}

function lineCounts(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line !== '') counts.set(line, (counts.get(line) ?? 0) + 1);
  }
  return counts;
}

// Multiset difference: each line as many times as `a` has it more than `b`.
function minus(a: Map<string, number>, b: Map<string, number>): Map<string, number> {
  const out = new Map<string, number>();
  for (const [line, n] of a) if (n > (b.get(line) ?? 0)) out.set(line, n - (b.get(line) ?? 0));
  return out;
}

function size(counts: Map<string, number>): number {
  return [...counts.values()].reduce((sum, n) => sum + n, 0);
}

function sharedWith(wanted: Map<string, number>, have: Map<string, number>): number {
  let n = 0;
  for (const [line, count] of wanted) n += Math.min(count, have.get(line) ?? 0);
  return n;
}

// Deterministic, no LLM: did the output make the developer's changes, and drop what they dropped?
// True when the developer changed no line that counts: such a case cannot be scored.
export function hasScorableChange(rejected: string, expected: string): boolean {
  const r = lineCounts(rejected);
  const e = lineCounts(expected);
  return size(minus(e, r)) + size(minus(r, e)) > 0;
}

export function scoreOutput(input: { readonly rejected: string; readonly expected: string; readonly output: string }): Score {
  const rejected = lineCounts(input.rejected);
  const expected = lineCounts(input.expected);
  const output = lineCounts(input.output);
  const added = minus(expected, rejected);
  const removed = minus(rejected, expected);
  // Counts kept as integers so the pass decision is exact (6/7 × 7/12 is 0.5, not 0.4999…).
  const [hit, total] = size(added) === 0 ? [1, 1] : [sharedWith(added, output), size(added)];
  const [kept, gone] = size(removed) === 0 ? [0, 1] : [sharedWith(removed, output), size(removed)];
  const coverage = hit / total;
  const repeat = kept / gone;
  return { coverage, repeat, score: coverage * (1 - repeat), pass: 2 * hit * (gone - kept) >= total * gone };
}

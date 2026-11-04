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
export function scoreOutput(input: { readonly rejected: string; readonly expected: string; readonly output: string }): Score {
  const rejected = lineCounts(input.rejected);
  const expected = lineCounts(input.expected);
  const output = lineCounts(input.output);
  const added = minus(expected, rejected);
  const removed = minus(rejected, expected);
  const coverage = size(added) === 0 ? 1 : sharedWith(added, output) / size(added);
  const repeat = size(removed) === 0 ? 0 : sharedWith(removed, output) / size(removed);
  const score = coverage * (1 - repeat);
  return { coverage, repeat, score, pass: score >= PASS_SCORE };
}

// Line-based Myers diff (O(ND)), rendered as a unified diff from the AI version to the developer's.

const CONTEXT = 3;
const DEFAULT_MAX_EDITS = 2_000;
const NO_NEWLINE = '\\ No newline at end of file';

type Op = { readonly kind: ' ' | '-' | '+'; readonly line: string; readonly eof: boolean };

interface Lines {
  readonly items: readonly string[];
  readonly noNewline: boolean;
}

function splitLines(text: string): Lines {
  if (text === '') return { items: [], noNewline: false };
  const items = text.split('\n');
  const noNewline = items[items.length - 1] !== '';
  if (!noNewline) items.pop();
  return { items, noNewline };
}

// A last line without newline must not equal the same text with one.
function keys(lines: Lines): readonly string[] {
  if (!lines.noNewline) return lines.items;
  return lines.items.map((line, i) => (i === lines.items.length - 1 ? `${line}\0` : line));
}

// Returns the edit script, or null when more than `maxEdits` lines differ.
function myers(a: readonly string[], b: readonly string[], maxEdits: number): Array<{ kind: Op['kind']; ai: number; dev: number }> | null {
  const n = a.length;
  const m = b.length;
  const max = Math.min(n + m, maxEdits);
  const offset = max + 1;
  const v = new Int32Array(2 * max + 3);
  // Each entry keeps only the diagonals that step d reads: [-(d + 1), d + 1].
  const trace: Int32Array[] = [];
  let found = -1;

  for (let d = 0; d <= max && found === -1; d++) {
    trace.push(v.slice(offset - d - 1, offset + d + 2));
    for (let k = -d; k <= d; k += 2) {
      const down = k === -d || (k !== d && (v[offset + k - 1] as number) < (v[offset + k + 1] as number));
      let x = down ? (v[offset + k + 1] as number) : (v[offset + k - 1] as number) + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) {
        found = d;
        break;
      }
    }
  }
  if (found === -1) return null;

  const script: Array<{ kind: Op['kind']; ai: number; dev: number }> = [];
  let x = n;
  let y = m;
  for (let d = found; d >= 0; d--) {
    const snap = trace[d] as Int32Array;
    const at = (k: number) => snap[k + d + 1] as number;
    const k = x - y;
    const prevK = k === -d || (k !== d && at(k - 1) < at(k + 1)) ? k + 1 : k - 1;
    const prevX = at(prevK);
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      x--;
      y--;
      script.push({ kind: ' ', ai: x, dev: y });
    }
    if (d > 0) {
      if (x === prevX) script.push({ kind: '+', ai: x, dev: prevY });
      else script.push({ kind: '-', ai: prevX, dev: y });
    }
    x = prevX;
    y = prevY;
  }
  return script.reverse();
}

function range(start: number, count: number): string {
  // Unified diff numbers lines from 1, and uses the line before for an empty range.
  if (count === 0) return `${start},0`;
  return count === 1 ? `${start + 1}` : `${start + 1},${count}`;
}

export interface DiffOptions {
  readonly maxEdits?: number;
}

export function unifiedDiff(ai: string, dev: string, options: DiffOptions = {}): string | null {
  const before = splitLines(ai);
  const after = splitLines(dev);
  const script = myers(keys(before), keys(after), options.maxEdits ?? DEFAULT_MAX_EDITS);
  if (script === null) return null;
  if (script.every((op) => op.kind === ' ')) return '';

  const lastAi = before.items.length - 1;
  const lastDev = after.items.length - 1;
  const ops = script.map((op) => {
    const fromAi = op.kind !== '+';
    const line = fromAi ? (before.items[op.ai] as string) : (after.items[op.dev] as string);
    const eof = fromAi ? before.noNewline && op.ai === lastAi : after.noNewline && op.dev === lastDev;
    // A context line is only "at EOF without newline" when it is so on both sides.
    return { ...op, line, eof: op.kind === ' ' ? eof && after.noNewline && op.dev === lastDev : eof };
  });

  const hunks: string[] = [];
  let i = 0;
  while (i < ops.length) {
    const firstChange = ops.findIndex((op, j) => j >= i && op.kind !== ' ');
    if (firstChange === -1) break;
    const start = Math.max(i, firstChange - CONTEXT);
    let end = firstChange;
    // Extend while the next change is close enough to share context.
    for (let j = firstChange; j < ops.length; j++) {
      if ((ops[j] as Op).kind !== ' ') end = j;
      else if (j - end > 2 * CONTEXT) break;
    }
    const stop = Math.min(ops.length, end + CONTEXT + 1);
    const slice = ops.slice(start, stop);
    const first = ops[start] as (typeof ops)[number];
    const aiCount = slice.filter((op) => op.kind !== '+').length;
    const devCount = slice.filter((op) => op.kind !== '-').length;
    const body = slice.map((op) => `${op.kind}${op.line}\n${op.eof ? `${NO_NEWLINE}\n` : ''}`).join('');
    // An op's index on the other side is the number of lines before it there.
    hunks.push(`@@ -${range(first.ai, aiCount)} +${range(first.dev, devCount)} @@\n${body}`);
    i = stop;
  }
  return `--- ai\n+++ dev\n${hunks.join('')}`;
}

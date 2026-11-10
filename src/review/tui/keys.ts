export type TuiKey =
  | { readonly type: 'up' }
  | { readonly type: 'down' }
  | { readonly type: 'toggleDiff' }
  | { readonly type: 'confirm' }
  | { readonly type: 'dismiss' }
  | { readonly type: 'reset' }
  | { readonly type: 'quit' }
  | { readonly type: 'unknown' };

// Consumes one key (or escape sequence) from a raw-mode stdin buffer.
export function consumeKey(buffer: string): { readonly key: TuiKey; readonly rest: string } | null {
  if (buffer.length === 0) return null;

  if (buffer.startsWith('\u001b[A')) return { key: { type: 'up' }, rest: buffer.slice(3) };
  if (buffer.startsWith('\u001b[B')) return { key: { type: 'down' }, rest: buffer.slice(3) };
  // Incomplete escape sequence: wait for more bytes.
  if (buffer === '\u001b' || buffer === '\u001b[') return null;
  if (buffer.startsWith('\u001b')) return { key: { type: 'unknown' }, rest: buffer.slice(1) };

  const ch = buffer[0]!;
  const rest = buffer.slice(1);
  if (ch === 'q' || ch === 'Q' || ch === '\u0003') return { key: { type: 'quit' }, rest };
  if (ch === 'j' || ch === 'J') return { key: { type: 'down' }, rest };
  if (ch === 'k' || ch === 'K') return { key: { type: 'up' }, rest };
  if (ch === ' ' || ch === '\r' || ch === '\n') return { key: { type: 'toggleDiff' }, rest };
  if (ch === 'c' || ch === 'C') return { key: { type: 'confirm' }, rest };
  if (ch === 'd' || ch === 'D') return { key: { type: 'dismiss' }, rest };
  if (ch === 'r' || ch === 'R') return { key: { type: 'reset' }, rest };
  return { key: { type: 'unknown' }, rest };
}

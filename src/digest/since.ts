import { parseDateOption } from '../shared/date-option.js';

export const DEFAULT_DIGEST_LOOKBACK_DAYS = 7;
const MAX_RELATIVE_DAYS = 365;

/** Start of (today UTC − days) as ISO, matching report `--since` semantics. */
export function sinceDaysAgo(now: Date, days: number): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

/**
 * Parses digest `--since`: omit → default 7d; `Nd` → N days ago; `YYYY-MM-DD` → that day UTC.
 */
export function parseDigestSince(raw: string | undefined, now: Date): { readonly since: string } | { readonly error: string } {
  if (raw === undefined) return { since: sinceDaysAgo(now, DEFAULT_DIGEST_LOOKBACK_DAYS) };
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { error: 'invalid --since: cannot be empty' };
  const relative = /^(\d+)d$/i.exec(trimmed);
  if (relative !== null) {
    const n = Number(relative[1]);
    if (!Number.isInteger(n) || n < 1 || n > MAX_RELATIVE_DAYS) {
      return {
        error: `--since relative days must be a whole number from 1 to ${MAX_RELATIVE_DAYS} (got: ${trimmed})`,
      };
    }
    return { since: sinceDaysAgo(now, n) };
  }
  const iso = parseDateOption(trimmed);
  if (iso === null) return { error: `invalid --since (use YYYY-MM-DD or Nd, e.g. 7d): ${trimmed}` };
  return { since: iso };
}

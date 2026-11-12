import { containsInlineSecret, redactInlineSecrets } from '../hooks/claude-code/sensitive.js';

/** Extra patterns beyond hook ingest (JWT-ish, generic bearer tokens). */
const EXTRA_SECRET_PATTERNS: readonly RegExp[] = [
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  /\bBearer\s+[A-Za-z0-9_\-.=]{20,}\b/gi,
];

const EMAIL_PATTERN = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g;

export const REDACTED_MARKER = '<redacted>';

export function redactSecrets(text: string): string {
  let out = redactInlineSecrets(text);
  for (const pattern of EXTRA_SECRET_PATTERNS) {
    out = out.replace(pattern, REDACTED_MARKER);
  }
  return out;
}

export function redactEmails(text: string): string {
  return text.replace(EMAIL_PATTERN, REDACTED_MARKER);
}

/** Keep first directory segment + basename; hide the middle with `**`. */
export function coarsenPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.length === 0) return normalized;
  const parts = normalized.split('/').filter((p) => p.length > 0);
  if (parts.length <= 2) return parts.join('/');
  const first = parts[0]!;
  const base = parts[parts.length - 1]!;
  return `${first}/**/${base}`;
}

export interface PrivacyTextOptions {
  readonly redactPaths?: boolean;
}

/**
 * Secrets first, then emails. When `redactPaths` is true and the whole string looks like a path,
 * coarsen it; otherwise leave non-path text alone (callers coarsen known path fields).
 */
export function applyPrivacy(text: string, options: PrivacyTextOptions = {}): string {
  let out = redactEmails(redactSecrets(text));
  if (options.redactPaths === true && looksLikePath(out)) {
    out = coarsenPath(out);
  }
  return out;
}

function looksLikePath(text: string): boolean {
  if (text.includes('\n') || text.includes(' ')) return false;
  return text.includes('/') || text.includes('\\');
}

export interface PrivacyCounts {
  readonly secrets: number;
  readonly emails: number;
  readonly paths: number;
  readonly skippedSensitive: number;
}

export function emptyPrivacyCounts(skippedSensitive = 0): PrivacyCounts {
  return Object.freeze({ secrets: 0, emails: 0, paths: 0, skippedSensitive });
}

export function countSecretsIn(text: string): number {
  if (containsInlineSecret(text)) return 1;
  return EXTRA_SECRET_PATTERNS.some((p) => {
    p.lastIndex = 0;
    return p.test(text);
  })
    ? 1
    : 0;
}

export function countEmailsIn(text: string): number {
  const matches = text.match(EMAIL_PATTERN);
  return matches?.length ?? 0;
}

export function wouldCoarsenPath(filePath: string): boolean {
  return coarsenPath(filePath) !== filePath.replace(/\\/g, '/').replace(/^\/+/, '');
}

export function addCounts(a: PrivacyCounts, b: PrivacyCounts): PrivacyCounts {
  return Object.freeze({
    secrets: a.secrets + b.secrets,
    emails: a.emails + b.emails,
    paths: a.paths + b.paths,
    skippedSensitive: a.skippedSensitive + b.skippedSensitive,
  });
}

export function formatPrivacyDryRun(counts: PrivacyCounts): string {
  return (
    `Privacy dry-run: secrets=${counts.secrets}, emails=${counts.emails}, ` +
    `paths=${counts.paths}, skippedSensitive=${counts.skippedSensitive}\n`
  );
}

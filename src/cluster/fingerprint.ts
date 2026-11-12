import { createHash } from 'node:crypto';
import { redactInlineSecrets } from '../hooks/claude-code/sensitive.js';
import { FINGERPRINT_HEX_LEN } from './types.js';

/** Strip whitespace so indentation/spacing-only churn does not split clusters. */
export function normalizeForFingerprint(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\s+/g, '');
}

function prepare(text: string): string {
  return normalizeForFingerprint(redactInlineSecrets(text));
}

/** Opaque hex digest of redacted+normalized AI vs final content. */
export function fingerprintFailure(aiContent: string, finalContent: string, _filePath = ''): string {
  const payload = `${prepare(aiContent)}\n---\n${prepare(finalContent)}`;
  return createHash('sha256').update(payload, 'utf8').digest('hex').slice(0, FINGERPRINT_HEX_LEN);
}

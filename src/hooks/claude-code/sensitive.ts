// File names whose content NightOwl never stores: secrets, keys, credentials.
const SENSITIVE_NAMES: readonly RegExp[] = [
  /^\.env(\..+)?$/i,
  /\.(pem|key|p12|pfx|jks|keystore|asc|gpg)$/i,
  /^id_(rsa|dsa|ecdsa|ed25519)$/i,
  /^\.?(npmrc|netrc|pgpass|pypirc)$/i,
  /^credentials(\.\w+)?$/i,
  /^secrets?\.(json|ya?ml|toml|env|ini)$/i,
  /^service-account.*\.json$/i,
];

// Patterns that match high-risk secrets and credentials inside file contents.
const INLINE_SECRET_PATTERNS: readonly RegExp[] = [
  /-----BEGIN\s+([A-Z0-9_\s]+)\s+KEY/i,
  /\bgh[pousr]_[A-Za-z0-9_]{36,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{82}\b/,
  /\bsk-ant-[A-Za-z0-9_\-]{32,}\b/,
  /\bsk-(?:proj-)?[A-Za-z0-9_\-]{32,}\b/,
  /\bA[K|S]IA[0-9A-Z]{16}\b/,
  /\bxox[baprs]-[A-Za-z0-9\-]{10,}\b/,
  /(?:api[_-]?key|secret|token|password|auth|bearer)\s*[:=]\s*['"][A-Za-z0-9_\-\.]{16,}['"]/i,
];

export function isSensitivePath(relativePath: string): boolean {
  const name = relativePath.split('/').pop() ?? '';
  return SENSITIVE_NAMES.some((pattern) => pattern.test(name));
}

export function containsInlineSecret(content: string | null | undefined): boolean {
  if (!content) return false;
  return INLINE_SECRET_PATTERNS.some((pattern) => pattern.test(content));
}

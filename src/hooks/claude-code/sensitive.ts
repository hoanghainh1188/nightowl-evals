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

export function isSensitivePath(relativePath: string): boolean {
  const name = relativePath.split('/').pop() ?? '';
  return SENSITIVE_NAMES.some((pattern) => pattern.test(name));
}

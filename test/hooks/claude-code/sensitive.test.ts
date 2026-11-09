import { describe, expect, it } from 'vitest';
import { containsInlineSecret, isSensitivePath } from '../../../src/hooks/claude-code/sensitive.js';

describe('isSensitivePath', () => {
  it.each([
    '.env',
    '.env.local',
    'config/.env.production',
    'certs/server.pem',
    'keys/private.key',
    'store.p12',
    'id_rsa',
    '.ssh/id_ed25519',
    '.npmrc',
    '.netrc',
    'aws/credentials',
    'config/secrets.yml',
    'service-account.json',
  ])('treats %s as sensitive', (path) => {
    expect(isSensitivePath(path)).toBe(true);
  });

  it.each(['src/env.ts', 'src/secretary.ts', 'id_rsa.pub', 'src/credentials-form.tsx', 'README.md'])(
    'treats %s as ordinary',
    (path) => {
      expect(isSensitivePath(path)).toBe(false);
    },
  );
});

describe('containsInlineSecret', () => {
  it.each([
    'const key = "-----BEGIN RSA PRIVATE KEY-----\\nMIIEowIBAAKCAQEA0...";',
    'const key = "-----BEGIN OPENSSH PRIVATE KEY-----\\nb3BlbnNzaC1rZXk...";',
    'const token = "ghp_123456789012345678901234567890123456";',
    'const token = "github_pat_11AAAAAAA0123456789012345678901234567890123456789012345678901234567890123456789012";',
    'export const ANTHROPIC_KEY = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890";',
    'export const OPENAI_KEY = "sk-proj-abcdefghijklmnopqrstuvwxyz1234567890";',
    'aws_access_key_id = AKIAIOSFODNN7EXAMPLE',
    'const slack = "xoxb-1234567890-1234567890123-abcdef";',
    'api_key: "abcdef1234567890abcdef123456"',
    'bearer = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0"',
  ])('detects secret in %s', (content) => {
    expect(containsInlineSecret(content)).toBe(true);
  });

  it.each([
    'const a = 1;',
    'function hello() { return "world"; }',
    '// normal comment with api_key documentation\nconst x = 42;',
    'import { secret } from "./secret.js";',
    '',
    null,
    undefined,
  ])('does not detect secret in ordinary content', (content) => {
    expect(containsInlineSecret(content)).toBe(false);
  });
});

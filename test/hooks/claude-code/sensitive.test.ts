import { describe, expect, it } from 'vitest';
import { isSensitivePath } from '../../../src/hooks/claude-code/sensitive.js';

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

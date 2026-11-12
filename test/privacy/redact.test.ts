import { describe, expect, it } from 'vitest';
import {
  REDACTED_MARKER,
  applyPrivacy,
  coarsenPath,
  countEmailsIn,
  countSecretsIn,
  formatPrivacyDryRun,
  redactEmails,
  redactSecrets,
  wouldCoarsenPath,
} from '../../src/privacy/index.js';

describe('redactSecrets', () => {
  it('redacts known hook secrets and extra JWT-like tokens', () => {
    const text = 'key sk-ant-abcdefghijklmnopqrstuvwxyz012345 and eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signaturepad';
    const out = redactSecrets(text);
    expect(out).toContain(REDACTED_MARKER);
    expect(out).not.toContain('sk-ant-abcdefghijklmnopqrstuvwxyz012345');
    expect(countSecretsIn(text)).toBeGreaterThan(0);
  });
});

describe('redactEmails', () => {
  it('redacts email addresses', () => {
    expect(redactEmails('ping user@example.com please')).toBe(`ping ${REDACTED_MARKER} please`);
    expect(countEmailsIn('a@b.co and c@d.com')).toBe(2);
  });
});

describe('coarsenPath', () => {
  it('hides middle segments', () => {
    expect(coarsenPath('src/hooks/git/run.ts')).toBe('src/**/run.ts');
    expect(wouldCoarsenPath('src/hooks/git/run.ts')).toBe(true);
  });

  it('leaves short paths unchanged', () => {
    expect(coarsenPath('src/foo.ts')).toBe('src/foo.ts');
    expect(coarsenPath('a.ts')).toBe('a.ts');
    expect(wouldCoarsenPath('src/foo.ts')).toBe(false);
  });
});

describe('applyPrivacy', () => {
  it('redacts secrets and emails, optionally paths', () => {
    const raw = 'leak user@example.com in src/a/b/c.ts';
    expect(applyPrivacy(raw)).toContain(REDACTED_MARKER);
    expect(applyPrivacy(raw)).not.toContain('user@example.com');
    expect(applyPrivacy('src/a/b/c.ts', { redactPaths: true })).toBe('src/**/c.ts');
  });
});

describe('formatPrivacyDryRun', () => {
  it('summarizes counts without embedding secrets', () => {
    const line = formatPrivacyDryRun({ secrets: 1, emails: 2, paths: 3, skippedSensitive: 4 });
    expect(line).toContain('secrets=1');
    expect(line).toContain('emails=2');
    expect(line).not.toMatch(/sk-ant-/);
  });
});

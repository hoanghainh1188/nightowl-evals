import { describe, expect, it } from 'vitest';
import { fingerprintFailure, normalizeForFingerprint } from '../../src/cluster/fingerprint.js';
import { clusterKey, clusterKeyForFailure, groupFailures } from '../../src/cluster/group.js';
import { FINGERPRINT_HEX_LEN } from '../../src/cluster/types.js';

describe('normalizeForFingerprint', () => {
  it('collapses whitespace so indent-only churn matches', () => {
    expect(normalizeForFingerprint('const  a = 1;\n')).toBe(normalizeForFingerprint('const a=1;\n'));
  });
});

describe('fingerprintFailure', () => {
  it('is deterministic for the same AI/final pair', () => {
    const a = fingerprintFailure('export const x = 1;\n', 'export const x = 2;\n', 'src/a.ts');
    const b = fingerprintFailure('export const x = 1;\n', 'export const x = 2;\n', 'src/b.ts');
    expect(a).toHaveLength(FINGERPRINT_HEX_LEN);
    expect(a).toBe(b);
  });

  it('does not embed secret plaintext in the fingerprint', () => {
    const secret = 'sk-ant-abcdefghijklmnopqrstuvwxyz0123456789';
    const fp = fingerprintFailure(`const k = "${secret}";\n`, 'const k = null;\n', 'src/a.ts');
    expect(fp).not.toContain(secret);
    expect(fp).toMatch(/^[0-9a-f]+$/);
    const same = fingerprintFailure(`token: "${secret}"\n`, 'token: null\n', 'src/a.ts');
    expect(same).not.toContain(secret);
  });

  it('ignores whitespace-only differences after normalize', () => {
    const a = fingerprintFailure('a=1\n', 'a = 2\n', 'src/a.ts');
    const b = fingerprintFailure('a = 1\n', 'a=2\n', 'src/a.ts');
    expect(a).toBe(b);
  });
});

describe('groupFailures', () => {
  it('puts same category/module/agent/fingerprint in one cluster', () => {
    const clusters = groupFailures(
      [
        {
          id: 1,
          filePath: 'src/auth/a.ts',
          category: 'convention',
          agent: 'claude-code',
          aiContent: 'x\n',
          finalContent: 'y\n',
        },
        {
          id: 2,
          filePath: 'src/auth/b.ts',
          category: 'convention',
          agent: 'claude-code',
          aiContent: 'x\n',
          finalContent: 'y\n',
        },
      ],
      { minCount: 2 },
    );
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.count).toBe(2);
    expect(clusters[0]?.key).toBe(
      clusterKey('convention', 'src/auth', 'claude-code', fingerprintFailure('x\n', 'y\n')),
    );
  });

  it('excludes dismissed by default', () => {
    const clusters = groupFailures(
      [
        {
          id: 1,
          filePath: 'src/a.ts',
          category: 'logic',
          agent: null,
          status: 'flagged',
          aiContent: 'a\n',
          finalContent: 'b\n',
        },
        {
          id: 2,
          filePath: 'src/b.ts',
          category: 'logic',
          agent: null,
          status: 'dismissed',
          aiContent: 'a\n',
          finalContent: 'b\n',
        },
      ],
      { minCount: 1, depth: 1 },
    );
    expect(clusters[0]?.count).toBe(1);
  });

  it('clusterKeyForFailure matches group key', () => {
    const failure = {
      id: 9,
      filePath: 'src/cli/x.ts',
      category: 'logic' as string | null,
      agent: 'cursor' as string | null,
      aiContent: 'old\n',
      finalContent: 'new\n',
    };
    expect(clusterKeyForFailure(failure, 2)).toBe(
      clusterKey('logic', 'src/cli', 'cursor', fingerprintFailure('old\n', 'new\n')),
    );
  });
});

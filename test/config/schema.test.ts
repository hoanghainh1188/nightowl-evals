import { describe, expect, it } from 'vitest';
import { mergeConfigs, parseConfigValue } from '../../src/config/schema.js';

describe('parseConfigValue', () => {
  it('accepts minimal version 1', () => {
    expect(parseConfigValue({ version: 1 }, 'cfg')).toEqual({});
  });

  it('accepts full v1 shape', () => {
    expect(
      parseConfigValue(
        {
          version: 1,
          failOnRate: 25,
          agents: ['claude-code'],
          workspaces: ['packages/app'],
          digest: { lookbackDays: 7 },
          prune: { profile: 'short' },
          privacy: { redactPaths: true },
        },
        'cfg',
      ),
    ).toEqual({
      failOnRate: 25,
      agents: ['claude-code'],
      workspaces: ['packages/app'],
      digestLookbackDays: 7,
      pruneProfile: 'short',
      redactPaths: true,
    });
  });

  it('rejects missing version, unknown keys, bad types', () => {
    expect(parseConfigValue({}, 'cfg')).toMatch(/missing required "version"/);
    expect(parseConfigValue({ version: 1, nope: 1 }, 'cfg')).toMatch(/unknown key "nope"/);
    expect(parseConfigValue({ version: 1, digest: { lookbackDays: 7, extra: 1 } }, 'cfg')).toMatch(
      /unknown key "extra"/,
    );
    expect(parseConfigValue({ version: 2 }, 'cfg')).toMatch(/unsupported version/);
    expect(parseConfigValue({ version: 1, failOnRate: 101 }, 'cfg')).toMatch(/failOnRate/);
    expect(parseConfigValue({ version: 1, agents: ['nope'] }, 'cfg')).toMatch(/unknown agent/);
  });

  it('rejects forbidden secret-ish keys anywhere', () => {
    expect(parseConfigValue({ version: 1, apiKey: 'x' }, 'cfg')).toMatch(/forbidden key "apiKey"/);
    expect(parseConfigValue({ version: 1, privacy: { token: 'x' } }, 'cfg')).toMatch(/forbidden key "token"/);
  });
});

describe('mergeConfigs', () => {
  it('lets overlay win per field', () => {
    expect(
      mergeConfigs(
        { failOnRate: 10, agents: ['claude-code'], redactPaths: false },
        { failOnRate: 20, pruneProfile: 'long' },
      ),
    ).toEqual({
      failOnRate: 20,
      agents: ['claude-code'],
      redactPaths: false,
      pruneProfile: 'long',
    });
  });
});

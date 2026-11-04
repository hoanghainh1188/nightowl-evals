import { describe, expect, it } from 'vitest';
import { main } from '../../src/cli/main.js';
import type { Command } from '../../src/commands/command.js';
import { createFakeIo } from '../helpers/fake-io.js';

function throwing(name: string, error: unknown): Command {
  return {
    name,
    summary: 'Always throws',
    run: async () => {
      throw error;
    },
  };
}

describe('main', () => {
  it('returns the command exit code when nothing throws', async () => {
    const fake = createFakeIo();
    expect(await main(['--version'], fake.io)).toBe(0);
  });

  it.each(['log', 'precommit', 'postcommit'])('exits 0 silently when the %s hook command throws', async (name) => {
    const fake = createFakeIo();
    const code = await main([name], fake.io, [throwing(name, new Error('boom'))]);
    expect(code).toBe(0);
    expect(fake.out()).toBe('');
    expect(fake.err()).toBe('');
  });

  it('reports the error and exits 1 when another command throws', async () => {
    const fake = createFakeIo();
    const code = await main(['report'], fake.io, [throwing('report', new Error('boom'))]);
    expect(code).toBe(1);
    expect(fake.err()).toBe('nightowl: boom\n');
  });

  it('handles non-Error throws', async () => {
    const fake = createFakeIo();
    const code = await main(['report'], fake.io, [throwing('report', 'plain string')]);
    expect(code).toBe(1);
    expect(fake.err()).toBe('nightowl: plain string\n');
  });
});

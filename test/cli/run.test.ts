import { describe, expect, it } from 'vitest';
import pkg from '../../package.json' with { type: 'json' };
import { run } from '../../src/cli/run.js';
import type { Command } from '../../src/commands/command.js';
import { createFakeIo } from '../helpers/fake-io.js';

describe('run', () => {
  it('prints the package version for --version', async () => {
    const fake = createFakeIo();
    const code = await run(['--version'], fake.io);
    expect(code).toBe(0);
    expect(fake.out()).toBe(`${pkg.version}\n`);
    expect(fake.err()).toBe('');
  });

  it('accepts -v as a short alias for --version', async () => {
    const fake = createFakeIo();
    expect(await run(['-v'], fake.io)).toBe(0);
    expect(fake.out()).toBe(`${pkg.version}\n`);
  });

  it('prints help listing every registered command for --help', async () => {
    const fake = createFakeIo();
    const code = await run(['--help'], fake.io);
    expect(code).toBe(0);
    for (const name of ['init', 'log', 'report', 'export']) {
      expect(fake.out()).toMatch(new RegExp(`^\\s+${name}\\s+\\S`, 'm'));
    }
    expect(fake.err()).toBe('');
  });

  it('prints the same help when called without arguments', async () => {
    const withFlag = createFakeIo();
    const bare = createFakeIo();
    await run(['--help'], withFlag.io);
    const code = await run([], bare.io);
    expect(code).toBe(0);
    expect(bare.out()).toBe(withFlag.out());
  });

  it('rejects an unknown command on stderr with exit code 1', async () => {
    const fake = createFakeIo();
    const code = await run(['reprot'], fake.io);
    expect(code).toBe(1);
    expect(fake.out()).toBe('');
    expect(fake.err()).toContain('reprot');
    expect(fake.err()).toContain('--help');
  });

  it('rejects an unknown global flag with exit code 1', async () => {
    const fake = createFakeIo();
    const code = await run(['--bogus'], fake.io);
    expect(code).toBe(1);
    expect(fake.out()).toBe('');
    expect(fake.err()).toContain('--bogus');
  });

  it('passes the remaining arguments to the selected command', async () => {
    const seen: string[][] = [];
    const probe: Command = {
      name: 'probe',
      summary: 'Test command',
      run: async (args) => {
        seen.push([...args]);
        return 7;
      },
    };
    const fake = createFakeIo();
    const code = await run(['probe', 'a', '--flag'], fake.io, [probe]);
    expect(code).toBe(7);
    expect(seen).toEqual([['a', '--flag']]);
  });
});

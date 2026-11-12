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
    for (const name of [
      'init',
      'doctor',
      'prune',
      'log',
      'report',
      'export',
      'digest',
      'ingest-ci',
      'ingest-pr',
      'ingest-revert',
      'suggest-rules',
      'suggest-regressions',
      'rule-impact',
      'completion',
    ]) {
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
      help: 'probe help\n',
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

  describe('command help', () => {
    function probe() {
      const calls: string[][] = [];
      const command: Command = {
        name: 'probe',
        summary: 'Test command',
        help: 'Usage: nightowl probe\n',
        run: async (args) => {
          calls.push([...args]);
          return 7;
        },
      };
      return { command, calls };
    }

    it.each([
      [['probe', '--help']],
      [['probe', '-h']],
      [['probe', '--out', 'x', '--help']],
      [['probe', '--out', '--help']],
      [['probe', '--', '--help']],
      [['help', 'probe']],
    ])(
      'prints the command help for %j without running the command',
      async (argv) => {
        const { command, calls } = probe();
        const fake = createFakeIo();
        expect(await run(argv, fake.io, [command])).toBe(0);
        expect(fake.out()).toBe('Usage: nightowl probe\n');
        expect(fake.err()).toBe('');
        expect(calls).toEqual([]);
      },
    );

    it.each([[['help']], [['help', '--help']], [['help', '-h']], [['help', 'help']]])(
      'prints the general help for %j',
      async (argv) => {
        const general = createFakeIo();
        const fake = createFakeIo();
        await run(['--help'], general.io);
        expect(await run(argv, fake.io)).toBe(0);
        expect(fake.out()).toBe(general.out());
        expect(fake.err()).toBe('');
      },
    );

    it('shows hook help without reading stdin', async () => {
      const fake = createFakeIo({ stdin: '{"hook_event_name":"UserPromptSubmit"}' });
      expect(await run(['log', '--help'], fake.io)).toBe(0);
      expect(fake.out()).toMatch(/^Usage: nightowl log(?: \[--agent <id>\])?\n/);
      expect(fake.stdinReads()).toBe(0);
    });

    it('keeps control characters of an unknown command name off the terminal', async () => {
      const fake = createFakeIo();
      expect(await run(['help', 'x\u001b[2J'], fake.io)).toBe(1);
      expect(fake.err()).not.toContain('\u001b');
    });

    it('rejects help for an unknown command', async () => {
      const fake = createFakeIo();
      expect(await run(['help', 'reprot'], fake.io)).toBe(1);
      expect(fake.out()).toBe('');
      expect(fake.err()).toContain('reprot');
      expect(fake.err()).toContain('--help');
    });

    it('points to per-command help in the general help', async () => {
      const fake = createFakeIo();
      await run(['--help'], fake.io);
      expect(fake.out()).toContain("Run 'nightowl <command> --help' for its options.");
      expect(fake.out()).not.toMatch(/^\s+help\s/m);
    });

    // Every option each command parses must be documented in its help.
    it.each([
      ['report', ['--since', '--depth', '--json'], ['(default: 2)']],
      ['export', ['--out', '--force', '--since', '--category', '--format', '--regressions-dir'], ['(default: jsonl)']],
      ['classify', ['--yes', '--limit', '--model', '--redo'], ['(default: 20)', '(default: haiku)']],
      ['eval', ['--yes', '--input', '--model', '--limit'], ['(default: 20)', '(default: haiku, sonnet)', '(default: .nightowl/export/evals.jsonl)']],
    ])('documents every option of %s with its defaults', async (name, flags, defaults) => {
      const fake = createFakeIo();
      expect(await run([name, '--help'], fake.io)).toBe(0);
      for (const flag of flags) expect(fake.out()).toMatch(new RegExp(`^  ${flag}\\b`, 'm'));
      for (const value of defaults) expect(fake.out()).toContain(value);
    });

    it('gives every registered command a help text with a usage line', async () => {
      const { commands } = await import('../../src/commands/index.js');
      for (const command of commands) {
        expect(command.help).toMatch(new RegExp(`^Usage: nightowl ${command.name}\\b`));
        expect(command.help).toMatch(/-h, --help +Show this help\n$/);
      }
    });
  });
});

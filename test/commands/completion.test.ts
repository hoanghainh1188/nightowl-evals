import { describe, expect, it } from 'vitest';
import { createCompletionCommand } from '../../src/commands/completion.js';
import { buildCatalog } from '../../src/completion/catalog.js';
import type { Command } from '../../src/commands/command.js';
import { createFakeIo } from '../helpers/fake-io.js';

const stubCommands: readonly Command[] = [
  {
    name: 'export',
    summary: 'Export',
    help: 'Usage: nightowl export\n',
    run: async () => 0,
  },
  {
    name: 'report',
    summary: 'Report',
    help: 'Usage: nightowl report\n',
    run: async () => 0,
  },
  {
    name: 'completion',
    summary: 'Completion',
    help: 'Usage: nightowl completion\n',
    run: async () => 0,
  },
];

describe('nightowl completion', () => {
  async function run(args: readonly string[]) {
    const fake = createFakeIo();
    const code = await createCompletionCommand({ catalog: () => buildCatalog(stubCommands) }).run(args, fake.io);
    return { code, out: fake.out(), err: fake.err() };
  }

  it.each(['bash', 'zsh', 'fish', 'BASH'] as const)('prints a %s script', async (shell) => {
    const result = await run([shell]);
    expect(result.code).toBe(0);
    expect(result.out).toContain('export');
    expect(result.out.includes('format')).toBe(true);
    expect(result.err).toBe('');
  });

  it('rejects missing or unsupported shells', async () => {
    expect((await run([])).code).toBe(1);
    const bad = await run(['powershell']);
    expect(bad.code).toBe(1);
    expect(bad.err).toContain('unsupported shell');
    expect(bad.out).toBe('');
  });

  it('help text names bash zsh fish', () => {
    const help = createCompletionCommand().help;
    expect(help).toContain('bash|zsh|fish');
    expect(help).toMatch(/^Usage: nightowl completion/);
  });
});

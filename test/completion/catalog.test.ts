import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { commands } from '../../src/commands/index.js';
import {
  COMMAND_FLAGS,
  assertCatalogCoversCommands,
  buildCatalog,
  buildDefaultCatalog,
} from '../../src/completion/catalog.js';

describe('completion catalog', () => {
  it('has a flags entry for every registered command', () => {
    expect(() => assertCatalogCoversCommands(commands)).not.toThrow();
    for (const command of commands) {
      expect(COMMAND_FLAGS).toHaveProperty(command.name);
    }
  });

  it('includes completion itself in the built catalog', () => {
    const catalog = buildCatalog(commands);
    expect(catalog.commands.map((c) => c.name)).toContain('completion');
    expect(catalog.commands.map((c) => c.name)).toContain('export');
    expect(buildDefaultCatalog().commands.map((c) => c.name)).toEqual(
      expect.arrayContaining(['completion', 'export', 'report']),
    );
  });

  it('lists distinct --write and --output for suggest-rules', () => {
    expect(COMMAND_FLAGS['suggest-rules']).toEqual(
      expect.arrayContaining(['--write', '--output', '--force']),
    );
  });

  it('lists --config for config-aware commands', () => {
    for (const name of ['report', 'digest', 'prune', 'doctor', 'dashboard', 'export', 'share-pack'] as const) {
      expect(COMMAND_FLAGS[name]).toEqual(expect.arrayContaining(['--config']));
    }
  });

  it('README documents eval/source install for three shells', async () => {
    const readme = await readFile(join(import.meta.dirname, '../../README.md'), 'utf8');
    expect(readme).toContain('nightowl completion');
    expect(readme).toContain('eval "$(nightowl completion bash)"');
    expect(readme).toContain('eval "$(nightowl completion zsh)"');
    expect(readme).toContain('nightowl completion fish | source');
  });
});

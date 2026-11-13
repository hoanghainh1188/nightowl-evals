import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../../src/completion/catalog.js';
import { renderCompletion } from '../../src/completion/render.js';
import type { Command } from '../../src/commands/command.js';

const fakeCommands: readonly Command[] = [
  {
    name: 'export',
    summary: 'Export failures',
    help: 'Usage: nightowl export\n',
    run: async () => 0,
  },
  {
    name: 'report',
    summary: 'Summarize failures',
    help: 'Usage: nightowl report\n',
    run: async () => 0,
  },
  {
    name: 'completion',
    summary: 'Print completion',
    help: 'Usage: nightowl completion\n',
    run: async () => 0,
  },
];

describe('renderCompletion', () => {
  const catalog = buildCatalog(fakeCommands);

  it.each(['bash', 'zsh', 'fish'] as const)('embeds commands and key flags for %s', (shell) => {
    const script = renderCompletion(shell, catalog);
    expect(script).toContain('export');
    expect(script).toContain('report');
    expect(script).toContain('completion');
    if (shell === 'fish') {
      expect(script).toContain('-l format');
      expect(script).toContain('-l fail-on-rate');
      expect(script).toContain('-l debug-timing');
    } else {
      expect(script).toContain('--format');
      expect(script).toContain('--fail-on-rate');
      expect(script).toContain('--debug-timing');
    }
  });

  it('zsh script registers via compdef and is safe to eval', () => {
    const script = renderCompletion('zsh', catalog);
    expect(script).toContain('compdef _nightowl nightowl');
    expect(script).not.toMatch(/_nightowl "\$@"\s*$/m);
  });
});

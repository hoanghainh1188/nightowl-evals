import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSuggestRulesCommand, type SuggestRulesDeps } from '../../src/commands/suggest-rules.js';
import { RULES_MARKER_END, RULES_MARKER_START } from '../../src/rules/types.js';
import { createFakeIo } from '../helpers/fake-io.js';
import { createFakeRepo, createTempDir, type TempDir } from '../helpers/temp-repo.js';
import { seed } from '../helpers/seed-failures.js';

describe('nightowl suggest-rules', () => {
  let repo: TempDir;

  beforeEach(async () => {
    repo = await createFakeRepo();
  });
  afterEach(() => repo.cleanup());

  function deps(overrides: Partial<SuggestRulesDeps> = {}): SuggestRulesDeps {
    return {
      cwd: () => repo.path,
      runClaude: async () => {
        throw new Error('claude should not run');
      },
      runApi: async () => {
        throw new Error('api should not run');
      },
      env: () => ({}),
      now: () => new Date('2026-11-09T12:00:00.000Z'),
      ...overrides,
    };
  }

  async function run(args: readonly string[] = [], d: SuggestRulesDeps = deps()) {
    const fake = createFakeIo();
    const code = await createSuggestRulesCommand(d).run(args, fake.io);
    return { code, out: fake.out(), err: fake.err() };
  }

  async function seedConfirmedConvention(count = 2): Promise<void> {
    const rows = Array.from({ length: count }, (_, i) => ({
      filePath: `src/mod/f${i}.ts`,
      category: 'convention' as const,
      status: 'confirmed' as const,
      // Same AI→final delta so fingerprint clustering groups them (roadmap #35).
      aiContent: 'ai naming\n',
      finalContent: 'dev naming\n',
      reason: 'naming',
    }));
    await seed(repo.path, rows);
  }

  it('errors when NightOwl is not set up', async () => {
    const outside = await createTempDir();
    try {
      const result = await run([], deps({ cwd: () => outside.path }));
      expect(result.code).toBe(1);
      expect(result.err).toMatch(/not set up|no git repository/i);
    } finally {
      await outside.cleanup();
    }
  });

  it('rejects bad flags', async () => {
    expect((await run(['--min-count', '0'])).code).toBe(1);
    expect((await run(['--category', 'nope'])).err).toContain('unknown --category');
    expect((await run(['--transport', 'ssh'])).err).toContain('--transport must be cli or api');
  });

  it('prints heuristic Markdown without calling a model', async () => {
    await seedConfirmedConvention(2);
    const calls = { claude: 0, api: 0 };
    const result = await run(
      [],
      deps({
        runClaude: async () => {
          calls.claude += 1;
          return '';
        },
        runApi: async () => {
          calls.api += 1;
          return '';
        },
      }),
    );
    expect(result.code).toBe(0);
    expect(calls).toEqual({ claude: 0, api: 0 });
    expect(result.out).toContain(RULES_MARKER_START);
    expect(result.out).toContain(RULES_MARKER_END);
    expect(result.out).toContain('## 1.');
    expect(result.out).toContain('via=heuristic');
  });

  it('filters by --category and respects --min-count', async () => {
    await seed(repo.path, [
      { filePath: 'src/a.ts', category: 'convention', status: 'confirmed' },
      { filePath: 'src/b.ts', category: 'convention', status: 'confirmed' },
      { filePath: 'src/c.ts', category: 'logic', status: 'confirmed' },
      { filePath: 'src/d.ts', category: 'logic', status: 'confirmed' },
    ]);
    const onlyLogic = await run(['--category', 'logic', '--min-count', '2']);
    expect(onlyLogic.out).toContain('category=`logic`');
    expect(onlyLogic.out).not.toContain('category=`convention`');

    const tooHigh = await run(['--category', 'convention', '--min-count', '3']);
    expect(tooHigh.out).toContain('No clusters met the threshold');
  });

  it('writes --output and refuses overwrite without --force', async () => {
    await seedConfirmedConvention(2);
    const target = join(repo.path, 'rules.md');
    const first = await run(['--output', 'rules.md']);
    expect(first.code).toBe(0);
    expect(first.out).toBe('');
    expect(first.err).toContain('wrote');
    expect(await readFile(target, 'utf8')).toContain(RULES_MARKER_START);

    await writeFile(target, 'my notes\n');
    const refused = await run(['--output', 'rules.md']);
    expect(refused.code).toBe(1);
    expect(refused.err).toContain('use --force');
    expect(await readFile(target, 'utf8')).toBe('my notes\n');

    expect((await run(['--output', 'rules.md', '--force'])).code).toBe(0);
    expect(await readFile(target, 'utf8')).toContain(RULES_MARKER_START);
  });

  it('injects --write into CLAUDE.md without touching outer content', async () => {
    await seedConfirmedConvention(2);
    const target = join(repo.path, 'CLAUDE.md');
    await writeFile(target, '# Project\n\nKeep me.\n');
    const first = await run(['--write', 'CLAUDE.md']);
    expect(first.code).toBe(0);
    expect(first.err).toContain('updated NightOwl block');
    const once = await readFile(target, 'utf8');
    expect(once.startsWith('# Project')).toBe(true);
    expect(once).toContain('Keep me.');
    expect(once).toContain(RULES_MARKER_START);
    expect(once).toContain(RULES_MARKER_END);

    const second = await run(['--write', 'CLAUDE.md']);
    expect(second.code).toBe(0);
    const twice = await readFile(target, 'utf8');
    expect(twice).toContain('Keep me.');
    expect(twice.split(RULES_MARKER_START)).toHaveLength(2);
    expect(twice.split(RULES_MARKER_END)).toHaveLength(2);

    expect((await run(['--write', 'CLAUDE.md', '--output', 'x.md'])).code).toBe(1);
  });

  it('with --yes rewrites via LLM and falls back on failure', async () => {
    await seedConfirmedConvention(2);
    const rewritten = JSON.stringify({
      type: 'result',
      structured_output: {
        rules: [{ title: 'Prefer local naming', body: 'Use the module naming style under `src/mod`.' }],
      },
    });
    const ok = await run(
      ['--yes'],
      deps({
        runClaude: async () => rewritten,
      }),
    );
    expect(ok.code).toBe(0);
    expect(ok.out).toContain('Prefer local naming');
    expect(ok.out).toContain('via=llm');
    expect(ok.err).toContain('rewrote');

    const fallback = await run(
      ['--yes'],
      deps({
        runClaude: async () => {
          throw new Error('boom');
        },
      }),
    );
    expect(fallback.code).toBe(0);
    expect(fallback.out).toContain('via=heuristic');
  });

  it('requires ANTHROPIC_API_KEY for --transport api', async () => {
    await seedConfirmedConvention(2);
    const result = await run(['--yes', '--transport', 'api'], deps({ env: () => ({}) }));
    expect(result.code).toBe(1);
    expect(result.err).toContain('ANTHROPIC_API_KEY');
  });

  it('documents defaults in --help', async () => {
    const cmd = createSuggestRulesCommand(deps());
    expect(cmd.help).toContain('Does not call an LLM');
    expect(cmd.help).toContain('CLAUDE.md');
    expect(cmd.help).toContain('--write');
    expect(cmd.help).toContain('--output');
    expect(cmd.help).toContain('no longer an alias');
    expect(cmd.help).toContain('--yes');
  });
});

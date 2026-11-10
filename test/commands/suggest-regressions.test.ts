import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createSuggestRegressionsCommand,
  type SuggestRegressionsDeps,
} from '../../src/commands/suggest-regressions.js';
import { REGRESSION_MARKER } from '../../src/regressions/types.js';
import { createFakeIo } from '../helpers/fake-io.js';
import { seed } from '../helpers/seed-failures.js';
import { createFakeRepo, createTempDir, type TempDir } from '../helpers/temp-repo.js';

describe('nightowl suggest-regressions', () => {
  let repo: TempDir;

  beforeEach(async () => {
    repo = await createFakeRepo();
  });
  afterEach(() => repo.cleanup());

  function deps(overrides: Partial<SuggestRegressionsDeps> = {}): SuggestRegressionsDeps {
    return {
      cwd: () => repo.path,
      runClaude: async () => {
        throw new Error('claude should not run');
      },
      runApi: async () => {
        throw new Error('api should not run');
      },
      env: () => ({}),
      ...overrides,
    };
  }

  async function run(args: readonly string[] = [], d: SuggestRegressionsDeps = deps()) {
    const fake = createFakeIo();
    const code = await createSuggestRegressionsCommand(d).run(args, fake.io);
    return { code, out: fake.out(), err: fake.err() };
  }

  async function seedConfirmed(count = 1): Promise<void> {
    await seed(
      repo.path,
      Array.from({ length: count }, (_, i) => ({
        filePath: `src/f${i}.ts`,
        category: 'logic' as const,
        status: 'confirmed' as const,
        aiContent: `ai ${i}\n`,
        finalContent: `dev ${i}\n`,
        reason: 'bug',
      })),
    );
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
    expect((await run(['--limit', '0'])).code).toBe(1);
    expect((await run(['--framework', 'mocha'])).err).toContain('--framework must be');
    expect((await run(['--category', 'nope'])).err).toContain('unknown --category');
  });

  it('previews without writing or calling a model', async () => {
    await seedConfirmed(1);
    const calls = { claude: 0, api: 0 };
    const result = await run(
      ['--framework', 'json'],
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
    expect(result.out).toContain('Would write');
    expect(result.out).toContain('"schema": "nightowl.eval/v1"');
  });

  it('writes fixtures and stubs with --output', async () => {
    await seedConfirmed(1);
    const outDir = join(repo.path, 'test/regressions');
    const result = await run(['--output', 'test/regressions', '--framework', 'vitest']);
    expect(result.code).toBe(0);
    expect(result.err).toContain('wrote');
    const files = await import('node:fs/promises').then((fs) => fs.readdir(outDir));
    expect(files.some((f) => f.endsWith('.json'))).toBe(true);
    expect(files.some((f) => f.endsWith('.test.ts'))).toBe(true);
    const stub = await readFile(
      join(outDir, files.find((f) => f.endsWith('.test.ts'))!),
      'utf8',
    );
    expect(stub).toContain(REGRESSION_MARKER);
    expect(stub).toContain('it.todo');
  });

  it('refuses overwrite without --force', async () => {
    await seedConfirmed(1);
    await run(['--output', 'regs', '--framework', 'json']);
    const files = await import('node:fs/promises').then((fs) => fs.readdir(join(repo.path, 'regs')));
    const jsonPath = join(repo.path, 'regs', files[0]!);
    await writeFile(jsonPath, 'not nightowl\n');
    const refused = await run(['--output', 'regs', '--framework', 'json']);
    expect(refused.code).toBe(1);
    expect(refused.err).toContain('use --force');
    expect((await run(['--output', 'regs', '--framework', 'json', '--force'])).code).toBe(0);
  });

  it('with --yes rewrites titles and falls back on failure', async () => {
    await seedConfirmed(1);
    const rewritten = JSON.stringify({
      type: 'result',
      structured_output: {
        items: [{ title: 'Keep the edge case fixed', description: 'Do not regress the developer fix.' }],
      },
    });
    const ok = await run(
      ['--yes', '--framework', 'json'],
      deps({ runClaude: async () => rewritten }),
    );
    expect(ok.code).toBe(0);
    expect(ok.out).toContain('Keep the edge case fixed');
    expect(ok.err).toContain('rewrote titles');

    const fallback = await run(
      ['--yes', '--framework', 'json'],
      deps({
        runClaude: async () => {
          throw new Error('boom');
        },
      }),
    );
    expect(fallback.code).toBe(0);
    expect(fallback.out).toContain('Would write');
  });

  it('documents defaults in help', () => {
    const cmd = createSuggestRegressionsCommand(deps());
    expect(cmd.help).toContain('Does not call an LLM');
    expect(cmd.help).toContain('--output');
    expect(cmd.help).toContain('--yes');
  });
});

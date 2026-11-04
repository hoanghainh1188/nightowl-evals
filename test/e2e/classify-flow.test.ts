import { execFileSync, spawnSync } from 'node:child_process';
import { chmod, writeFile } from 'node:fs/promises';
import { delimiter, dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hookFixture } from '../helpers/fixtures.js';
import { createFakeClaude, type FakeClaude } from '../helpers/fake-claude.js';
import { createGitRepo, git } from '../helpers/git-repo.js';
import { type TempDir, writeFiles } from '../helpers/temp-repo.js';

const BIN = join(import.meta.dirname, '../../dist/bin.js');
const GIT_DIR = dirname(execFileSync('which', ['git'], { encoding: 'utf8' }).trim());
const ANSWER = JSON.stringify({
  type: 'result',
  structured_output: { category: 'missing-context', reason: 'the AI did not know the constant', confidence: 0.7 },
});

describe('failures from real commits → nightowl classify', () => {
  let repo: TempDir;
  let claude: FakeClaude;
  let env: NodeJS.ProcessEnv;

  beforeEach(async () => {
    repo = await createGitRepo();
    claude = await createFakeClaude(ANSWER);
    const shim = join(claude.dir.path, 'nightowl');
    await writeFile(shim, `#!/bin/sh\nexec "${process.execPath}" "${BIN}" "$@"\n`);
    await chmod(shim, 0o755);
    env = { ...process.env, PATH: [claude.path, GIT_DIR].join(delimiter) };
  });
  afterEach(async () => {
    await repo.cleanup();
    await claude.dir.cleanup();
  });

  function nightowl(args: readonly string[], input = '') {
    return spawnSync(process.execPath, [BIN, ...args], { cwd: repo.path, env, input, encoding: 'utf8' });
  }

  async function aiWroteThenDevCommitted(file: string): Promise<void> {
    await writeFiles(repo.path, { [file]: 'export const a = 1;\n' });
    const payload = JSON.parse(hookFixture('post-tool-use-write', repo.path)) as { tool_input: { file_path: string } };
    payload.tool_input.file_path = join(repo.path, file);
    expect(nightowl(['log'], JSON.stringify(payload)).status).toBe(0);
    await writeFiles(repo.path, { [file]: 'export const a = 2;\n' });
    git(repo.path, ['add', '-A'], env);
    expect(spawnSync('git', ['commit', '-q', '-m', file], { cwd: repo.path, env, stdio: 'ignore' }).status).toBe(0);
  }

  function categories(): Array<string | null> {
    const db = new DatabaseSync(join(repo.path, '.nightowl/nightowl.db'));
    try {
      return (db.prepare('SELECT category FROM failures ORDER BY id').all() as Array<{ category: string | null }>).map((r) => r.category);
    } finally {
      db.close();
    }
  }

  it('dry-runs, then classifies both failures through claude', async () => {
    expect(nightowl(['init']).status).toBe(0);
    await aiWroteThenDevCommitted('src/a.ts');
    await aiWroteThenDevCommitted('src/b.ts');
    expect(nightowl(['failures']).stdout).toBe('2 failures recorded\n  flagged: 2\n');

    const dry = nightowl(['classify']);
    expect(dry.status).toBe(0);
    expect(dry.stdout).toContain('Would send 2 failures');
    expect(await claude.calls()).toEqual([]);
    expect(categories()).toEqual([null, null]);

    const real = nightowl(['classify', '--yes']);
    expect(real.stdout).toBe('Classified 2 of 2 failures\n  missing-context: 2\n');
    expect(real.status).toBe(0);
    expect(categories()).toEqual(['missing-context', 'missing-context']);
    const calls = await claude.calls();
    expect(calls).toHaveLength(2);
    expect(calls.every((call) => call.internal === '1' && call.args.includes('--no-session-persistence'))).toBe(true);
    expect(calls[0]?.stdin).toContain('export const a = 2;');
  });
});

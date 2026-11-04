import { execFileSync, spawnSync } from 'node:child_process';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { delimiter, dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hookFixture } from '../helpers/fixtures.js';
import { createGitRepo, git } from '../helpers/git-repo.js';
import { createTempDir, type TempDir, writeFiles } from '../helpers/temp-repo.js';

const BIN = join(import.meta.dirname, '../../dist/bin.js');
const GIT_DIR = dirname(execFileSync('which', ['git'], { encoding: 'utf8' }).trim());

describe('real commits → nightowl report and export', () => {
  let repo: TempDir;
  let shimDir: TempDir;
  let env: NodeJS.ProcessEnv;

  beforeEach(async () => {
    repo = await createGitRepo();
    shimDir = await createTempDir();
    await writeFile(join(shimDir.path, 'nightowl'), `#!/bin/sh\nexec "${process.execPath}" "${BIN}" "$@"\n`);
    await chmod(join(shimDir.path, 'nightowl'), 0o755);
    env = { ...process.env, PATH: [shimDir.path, GIT_DIR, '/usr/bin', '/bin'].join(delimiter) };
  });
  afterEach(async () => {
    await repo.cleanup();
    await shimDir.cleanup();
  });

  function nightowl(args: readonly string[], input = '') {
    return spawnSync(process.execPath, [BIN, ...args], { cwd: repo.path, env, input, encoding: 'utf8' });
  }

  async function aiThenDev(file: string, ai: string, dev: string): Promise<void> {
    await writeFiles(repo.path, { [file]: ai });
    const payload = JSON.parse(hookFixture('post-tool-use-write', repo.path)) as { tool_input: { file_path: string } };
    payload.tool_input.file_path = join(repo.path, file);
    expect(nightowl(['log'], JSON.stringify(payload)).status).toBe(0);
    await writeFiles(repo.path, { [file]: dev });
    git(repo.path, ['add', '-A'], env);
    expect(spawnSync('git', ['commit', '-q', '-m', file], { cwd: repo.path, env, stdio: 'ignore' }).status).toBe(0);
  }

  it('reports and exports the failures of real commits', async () => {
    expect(nightowl(['init']).status).toBe(0);
    await writeFiles(repo.path, { 'src/core/a.ts': 'v0\n' });
    git(repo.path, ['add', '-A'], env);
    git(repo.path, ['commit', '-q', '-m', 'base'], env);
    await aiThenDev('src/core/a.ts', 'v1\n', 'v2\n');
    await aiThenDev('src/ui/b.ts', 'b1\n', 'b2\n');

    const text = nightowl(['report']);
    expect(text.status).toBe(0);
    expect(text.stdout).toContain('2 failures (2 unclassified');
    expect(text.stdout).toContain('AI edits changed by the developer: 2 of 2 checked at commit (100%)');
    expect(text.stdout).toMatch(/^ {2}src\/core +1 /m);

    const json = JSON.parse(nightowl(['report', '--json']).stdout);
    expect(json.by_module.map((m: { module: string }) => m.module).sort()).toEqual(['src/core', 'src/ui']);

    const exported = nightowl(['export']);
    expect(exported.status).toBe(0);
    const cases = (await readFile(join(repo.path, '.nightowl/export/evals.jsonl'), 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(cases.map((c) => [c.file_path, c.input.file_before, c.rejected, c.expected])).toEqual([
      ['src/core/a.ts', 'v0\n', 'v1\n', 'v2\n'],
      ['src/ui/b.ts', null, 'b1\n', 'b2\n'],
    ]);
    expect(git(repo.path, ['status', '--porcelain'], env)).toBe('');
  });
});

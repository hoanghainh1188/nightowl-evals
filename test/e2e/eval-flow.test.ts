import { execFileSync, spawnSync } from 'node:child_process';
import { chmod, readdir, readFile, writeFile } from 'node:fs/promises';
import { delimiter, dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFakeClaude, type FakeClaude } from '../helpers/fake-claude.js';
import { createGitRepo, git } from '../helpers/git-repo.js';
import { type TempDir, writeFiles } from '../helpers/temp-repo.js';

const BIN = join(import.meta.dirname, '../../dist/bin.js');
const GIT_DIR = dirname(execFileSync('which', ['git'], { encoding: 'utf8' }).trim());
const FIXED = 'export const isAdult = (age: number) => age >= 18;\n';
const BROKEN = 'export const isAdult = (age: number) => age > 18;\n';

describe('real commits → export → nightowl eval', () => {
  let repo: TempDir;
  let claude: FakeClaude;
  let env: NodeJS.ProcessEnv;

  beforeEach(async () => {
    repo = await createGitRepo();
    // sonnet answers with the developer fix, haiku repeats the AI mistake.
    const dir = await createFakeClaude({ body: '' });
    const answer = (content: string) => JSON.stringify({ type: 'result', structured_output: { content } });
    await writeFile(join(dir.dir.path, 'good.json'), answer(FIXED));
    await writeFile(join(dir.dir.path, 'bad.json'), answer(BROKEN));
    const script = (await readFile(join(dir.dir.path, 'claude'), 'utf8')).replace(
      /\n$/,
      `\ncase " $* " in *" sonnet "*) cat "${dir.dir.path}/good.json" ;; *) cat "${dir.dir.path}/bad.json" ;; esac\n`,
    );
    await writeFile(join(dir.dir.path, 'claude'), script);
    claude = dir;
    await writeFile(join(claude.dir.path, 'nightowl'), `#!/bin/sh\nexec "${process.execPath}" "${BIN}" "$@"\n`);
    await chmod(join(claude.dir.path, 'nightowl'), 0o755);
    env = { ...process.env, PATH: [claude.path, GIT_DIR].join(delimiter) };
  });
  afterEach(async () => {
    await repo.cleanup();
    await claude.dir.cleanup();
  });

  function nightowl(args: readonly string[], input = '') {
    return spawnSync(process.execPath, [BIN, ...args], { cwd: repo.path, env, input, encoding: 'utf8' });
  }

  it('dry-runs, then scores each model against the developer fix', async () => {
    expect(nightowl(['init']).status).toBe(0);
    await writeFiles(repo.path, { 'src/age.ts': 'export const isAdult = (age: number) => false;\n' });
    git(repo.path, ['add', '-A'], env);
    git(repo.path, ['commit', '-q', '-m', 'base'], env);

    const session = { session_id: 's1', cwd: repo.path };
    nightowl(['log'], JSON.stringify({ ...session, hook_event_name: 'UserPromptSubmit', prompt: 'isAdult is true from 18' }));
    await writeFiles(repo.path, { 'src/age.ts': BROKEN });
    nightowl(
      ['log'],
      JSON.stringify({ ...session, hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: join(repo.path, 'src/age.ts'), content: BROKEN } }),
    );
    await writeFiles(repo.path, { 'src/age.ts': FIXED });
    git(repo.path, ['add', '-A'], env);
    expect(spawnSync('git', ['commit', '-q', '-m', 'fix'], { cwd: repo.path, env, stdio: 'ignore' }).status).toBe(0);
    expect(nightowl(['export']).status).toBe(0);

    const dry = nightowl(['eval']);
    expect(dry.status).toBe(0);
    expect(dry.stdout).toContain('Would run 1 cases × 2 models (haiku, sonnet) = 2 calls');
    expect(await claude.calls()).toEqual([]);

    const real = nightowl(['eval', '--yes']);
    expect(real.stderr).toBe('');
    expect(real.status).toBe(0);
    expect(real.stdout).toMatch(/^ {2}haiku +1 +0 +0\.00 +0$/m);
    expect(real.stdout).toMatch(/^ {2}sonnet +1 +1 +1\.00 +0$/m);
    expect(real.stdout).toMatch(/passed by sonnet; not by haiku/);
    const calls = await claude.calls();
    expect(calls).toHaveLength(2);
    expect(calls.every((call) => call.internal === '1' && call.stdin.includes('isAdult is true from 18'))).toBe(true);
    expect(await readdir(join(repo.path, '.nightowl/runs'))).toHaveLength(1);
    expect(git(repo.path, ['status', '--porcelain'], env)).toBe('');
  });
});

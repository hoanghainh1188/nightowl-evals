import { execFileSync, spawnSync } from 'node:child_process';
import { chmod, writeFile } from 'node:fs/promises';
import { delimiter, dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGitRepo, git } from '../helpers/git-repo.js';
import { createTempDir, type TempDir, writeFiles } from '../helpers/temp-repo.js';

const BIN = join(import.meta.dirname, '../../dist/bin.js');
const GIT_DIR = dirname(execFileSync('which', ['git'], { encoding: 'utf8' }).trim());
const WRONG = 'export const isAdult = (age: number) => age > 18;\n';
const RIGHT = 'export const isAdult = (age: number) => age >= 18;\n';

describe('the developer asks the AI to fix its own edit (built bin, real git)', () => {
  let repo: TempDir;
  let shims: TempDir;
  let env: NodeJS.ProcessEnv;

  beforeEach(async () => {
    repo = await createGitRepo();
    shims = await createTempDir();
    await writeFile(join(shims.path, 'nightowl'), `#!/bin/sh\nexec "${process.execPath}" "${BIN}" "$@"\n`);
    await chmod(join(shims.path, 'nightowl'), 0o755);
    env = { ...process.env, PATH: [shims.path, GIT_DIR, '/usr/bin', '/bin'].join(delimiter) };
  });

  afterEach(async () => {
    await repo.cleanup();
    await shims.cleanup();
  });

  const nightowl = (args: readonly string[], input = '') =>
    spawnSync(process.execPath, [BIN, ...args], { cwd: repo.path, env, input, encoding: 'utf8' });

  const session = () => ({ session_id: 's1', cwd: repo.path });
  const said = (prompt: string) => nightowl(['log'], JSON.stringify({ ...session(), hook_event_name: 'UserPromptSubmit', prompt }));
  async function aiWrote(content: string): Promise<void> {
    await writeFiles(repo.path, { 'src/age.ts': content });
    const file_path = join(repo.path, 'src/age.ts');
    nightowl(['log'], JSON.stringify({ ...session(), hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path, content } }));
  }

  it('records an ai-self-fix failure that report and export show', async () => {
    expect(nightowl(['init']).status).toBe(0);
    said('isAdult is true from 18');
    await aiWrote(WRONG);
    said('wrong, 18 counts as adult');
    await aiWrote(RIGHT);
    git(repo.path, ['add', 'src/age.ts'], env);
    expect(spawnSync('git', ['commit', '-q', '-m', 'age'], { cwd: repo.path, env, stdio: 'ignore' }).status).toBe(0);

    expect(nightowl(['failures']).stdout).toBe('1 failure recorded\n  flagged: 1\n');
    expect(JSON.parse(nightowl(['report', '--json']).stdout).by_source).toEqual({ 'manual-fix': 0, 'ai-self-fix': 1 });
    const [line] = nightowl(['export', '--out', '-']).stdout.trim().split('\n');
    expect(JSON.parse(line as string)).toMatchObject({
      source: 'ai-self-fix',
      input: { prompt: 'isAdult is true from 18', feedback: 'wrong, 18 counts as adult' },
      rejected: WRONG,
      expected: RIGHT,
    });
  });
});

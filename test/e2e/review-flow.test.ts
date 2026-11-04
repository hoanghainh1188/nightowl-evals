import { execFileSync, spawnSync } from 'node:child_process';
import { chmod, writeFile } from 'node:fs/promises';
import { delimiter, dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGitRepo, git } from '../helpers/git-repo.js';
import { createTempDir, type TempDir, writeFiles } from '../helpers/temp-repo.js';

const BIN = join(import.meta.dirname, '../../dist/bin.js');
const GIT_DIR = dirname(execFileSync('which', ['git'], { encoding: 'utf8' }).trim());

describe('reviewing a recorded failure (built bin, real git)', () => {
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

  it('lists, shows, dismisses and resets a failure; report and export follow', async () => {
    expect(nightowl(['init']).status).toBe(0);
    const session = { session_id: 's1', cwd: repo.path };
    nightowl(['log'], JSON.stringify({ ...session, hook_event_name: 'UserPromptSubmit', prompt: 'make a 1' }));
    const file_path = join(repo.path, 'a.ts');
    await writeFiles(repo.path, { 'a.ts': 'export const a = 2;\n' });
    nightowl(['log'], JSON.stringify({ ...session, hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path, content: 'x' } }));
    await writeFiles(repo.path, { 'a.ts': 'export const a = 1;\n' });
    git(repo.path, ['add', 'a.ts'], env);
    expect(spawnSync('git', ['commit', '-q', '-m', 'a'], { cwd: repo.path, env, stdio: 'ignore' }).status).toBe(0);

    const list = nightowl(['review']);
    const id = /^#(\d+)/m.exec(list.stdout)?.[1];
    expect(id).toBeDefined();
    expect(list.stdout).toContain('"make a 1"');
    expect(nightowl(['review', 'show', id as string]).stdout).toContain('+export const a = 1;');

    expect(nightowl(['review', 'dismiss', id as string]).status).toBe(0);
    expect(JSON.parse(nightowl(['report', '--json']).stdout)).toMatchObject({ total: 0, by_status: { dismissed: 1, flagged: 0 } });
    expect(nightowl(['export', '--out', '-']).stdout).toBe('');
    expect(nightowl(['review']).stdout).toBe('No flagged failures. Try: nightowl review --status all\n');

    expect(nightowl(['review', 'reset', `#${id}`]).status).toBe(0);
    expect(JSON.parse(nightowl(['report', '--json']).stdout).total).toBe(1);
  });
});

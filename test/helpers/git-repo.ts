import { execFileSync } from 'node:child_process';
import { createTempDir, type TempDir } from './temp-repo.js';

export function git(cwd: string, args: readonly string[], env: NodeJS.ProcessEnv = process.env): string {
  return execFileSync('git', [...args], { cwd, env, encoding: 'utf8' });
}

// A real repository with a deterministic identity and an initial commit.
export async function createGitRepo(): Promise<TempDir> {
  const dir = await createTempDir();
  git(dir.path, ['init', '-q', '-b', 'main']);
  git(dir.path, ['config', 'user.name', 'Nguyen Test Dev']);
  git(dir.path, ['config', 'user.email', 'dev@example.test']);
  git(dir.path, ['commit', '-q', '--allow-empty', '-m', 'init']);
  return dir;
}

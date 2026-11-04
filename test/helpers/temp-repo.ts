import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface TempDir {
  readonly path: string;
  readonly cleanup: () => Promise<void>;
}

export async function createTempDir(prefix = 'nightowl-'): Promise<TempDir> {
  const path = await realpath(await mkdtemp(join(tmpdir(), prefix)));
  return { path, cleanup: () => rm(path, { recursive: true, force: true }) };
}

// A directory that looks like a git repo to findProjectRoot (no git binary needed).
export async function createFakeRepo(): Promise<TempDir> {
  const dir = await createTempDir();
  await mkdir(join(dir.path, '.git'));
  return dir;
}

export async function writeFiles(root: string, files: Readonly<Record<string, string>>): Promise<void> {
  for (const [relative, content] of Object.entries(files)) {
    const target = join(root, relative);
    await mkdir(join(target, '..'), { recursive: true });
    await writeFile(target, content);
  }
}

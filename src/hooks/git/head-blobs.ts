import { runGit } from './run-git.js';

export async function resolveHead(root: string, timeoutMs?: number): Promise<string> {
  return (await runGit(['rev-parse', '--verify', 'HEAD^{commit}'], { cwd: root, timeoutMs })).toString('utf8').trim();
}

// Blob ids of the given files in `commit`, with one `git cat-file --batch-check` process.
// Missing files and directories are left out.
export async function readBlobIds(
  root: string,
  commit: string,
  paths: readonly string[],
  timeoutMs?: number,
): Promise<ReadonlyMap<string, string>> {
  const readable = paths.filter((path) => !path.includes('\n'));
  if (readable.length === 0) return new Map();
  const input = readable.map((path) => `${commit}:${path}\n`).join('');
  const out = await runGit(['cat-file', '--batch-check'], { cwd: root, input, timeoutMs });

  const lines = out.toString('utf8').split('\n');
  const blobs = new Map<string, string>();
  readable.forEach((path, index) => {
    const match = /^([0-9a-f]+) blob \d+$/.exec(lines[index] ?? '');
    if (match) blobs.set(path, match[1] as string);
  });
  return blobs;
}

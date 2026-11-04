import { runGit } from './run-git.js';

export interface StagedFile {
  readonly blob: string;
  readonly content: string;
}

export async function listStagedFiles(root: string, timeoutMs?: number): Promise<readonly string[]> {
  const out = await runGit(['diff', '--cached', '--name-only', '-z', '--diff-filter=AM'], { cwd: root, timeoutMs });
  return out.toString('utf8').split('\0').filter(Boolean);
}

// Reads staged blobs with one `git cat-file --batch` process, whatever the file count.
export async function readStagedFiles(
  root: string,
  paths: readonly string[],
  timeoutMs?: number,
): Promise<ReadonlyMap<string, StagedFile>> {
  const readable = paths.filter((path) => !path.includes('\n'));
  if (readable.length === 0) return new Map();
  const input = readable.map((path) => `:${path}\n`).join('');
  const out = await runGit(['cat-file', '--batch'], { cwd: root, input, timeoutMs });

  const files = new Map<string, StagedFile>();
  let offset = 0;
  for (const path of readable) {
    const headerEnd = out.indexOf(0x0a, offset);
    if (headerEnd === -1) break;
    const header = out.subarray(offset, headerEnd).toString('utf8');
    offset = headerEnd + 1;
    const match = /^([0-9a-f]+) (\w+) (\d+)$/.exec(header);
    if (!match) continue; // "<object> missing"
    const size = Number(match[3]);
    files.set(path, { blob: match[1] as string, content: out.subarray(offset, offset + size).toString('utf8') });
    offset += size + 1; // content is followed by a newline
  }
  return files;
}

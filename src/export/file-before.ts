import { runGit } from '../hooks/git/run-git.js';

export const MAX_FILE_BEFORE_BYTES = 512 * 1024;
const COMMIT_SHA = /^[0-9a-f]{7,64}$/;

export interface FileAtCommit {
  readonly commitSha: string;
  readonly filePath: string;
}

export function fileBeforeKey(item: FileAtCommit): string {
  return `${item.commitSha}\0${item.filePath}`;
}

// Content of each file in the parent of its commit, with one `git cat-file --batch` process.
// Anything git cannot give (new file, root commit, commit gone, odd path, too large) is left out.
export async function readFilesBefore(root: string, items: readonly FileAtCommit[]): Promise<ReadonlyMap<string, string>> {
  // Only plain hex shas: anything else could be read by git as another revision expression.
  const readable = items.filter((item) => COMMIT_SHA.test(item.commitSha) && !item.filePath.includes('\n'));
  if (readable.length === 0) return new Map();
  const input = readable.map((item) => `${item.commitSha}^:${item.filePath}\n`).join('');
  const out = await runGit(['cat-file', '--batch'], { cwd: root, input });

  const files = new Map<string, string>();
  let offset = 0;
  for (const item of readable) {
    const headerEnd = out.indexOf(0x0a, offset);
    if (headerEnd === -1) break;
    const header = out.subarray(offset, headerEnd).toString('utf8');
    offset = headerEnd + 1;
    const match = /^[0-9a-f]+ (\w+) (\d+)$/.exec(header);
    if (!match) continue; // "<object> missing" or "ambiguous": no content follows
    const size = Number(match[2]);
    if (match[1] === 'blob' && size <= MAX_FILE_BEFORE_BYTES) {
      files.set(fileBeforeKey(item), out.subarray(offset, offset + size).toString('utf8'));
    }
    offset += size + 1; // content is followed by a newline
  }
  return files;
}

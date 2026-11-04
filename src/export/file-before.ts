import { runGit } from '../hooks/git/run-git.js';

export const MAX_FILE_BEFORE_BYTES = 512 * 1024;
const GIT_TIMEOUT_MS = 30_000;
const COMMIT_SHA = /^[0-9a-f]{7,64}$/;
const STRICT_UTF8 = new TextDecoder('utf-8', { fatal: true });

export interface FileAtCommit {
  readonly commitSha: string;
  readonly filePath: string;
}

export function fileBeforeKey(item: FileAtCommit): string {
  return `${item.commitSha}\0${item.filePath}`;
}

function objectName(key: string): string {
  const [sha, path] = key.split('\0') as [string, string];
  return `${sha}^:${path}`;
}

// Source text only: binary or non-UTF-8 content would come out as plausible but wrong text.
function decode(bytes: Buffer): string | null {
  if (bytes.includes(0)) return null;
  try {
    return STRICT_UTF8.decode(bytes);
  } catch {
    return null;
  }
}

// Keys of the objects that are blobs no larger than the limit, from `--batch-check` (no content).
async function smallBlobs(root: string, keys: readonly string[]): Promise<readonly string[]> {
  const out = await runGit(['cat-file', '--batch-check'], {
    cwd: root,
    input: keys.map((key) => `${objectName(key)}\n`).join(''),
    timeoutMs: GIT_TIMEOUT_MS,
  });
  const lines = out.toString('utf8').split('\n');
  return keys.filter((_, i) => {
    const match = /^[0-9a-f]+ blob (\d+)$/.exec(lines[i] ?? '');
    return match !== null && Number(match[1]) <= MAX_FILE_BEFORE_BYTES;
  });
}

// Content of each file in the parent of its commit. Anything git cannot give as small UTF-8
// text (new file, root commit, commit gone, odd path, binary, too large) is left out.
export async function readFilesBefore(root: string, items: readonly FileAtCommit[]): Promise<ReadonlyMap<string, string>> {
  // Only plain hex shas: anything else could be read by git as another revision expression.
  const keys = [
    ...new Set(
      items.filter((item) => COMMIT_SHA.test(item.commitSha) && !item.filePath.includes('\n')).map(fileBeforeKey),
    ),
  ];
  if (keys.length === 0) return new Map();
  const wanted = await smallBlobs(root, keys);
  if (wanted.length === 0) return new Map();
  const out = await runGit(['cat-file', '--batch'], {
    cwd: root,
    input: wanted.map((key) => `${objectName(key)}\n`).join(''),
    timeoutMs: GIT_TIMEOUT_MS,
  });

  const files = new Map<string, string>();
  let offset = 0;
  for (const key of wanted) {
    const headerEnd = out.indexOf(0x0a, offset);
    if (headerEnd === -1) break;
    const match = /^[0-9a-f]+ (\w+) (\d+)$/.exec(out.subarray(offset, headerEnd).toString('utf8'));
    offset = headerEnd + 1;
    if (!match) continue; // gone since the size check: no content follows
    const size = Number(match[2]);
    const text = match[1] === 'blob' ? decode(out.subarray(offset, offset + size)) : null;
    if (text !== null) files.set(key, text);
    offset += size + 1; // content is followed by a newline
  }
  return files;
}

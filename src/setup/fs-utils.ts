import { randomBytes } from 'node:crypto';
import { lstat, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

export class SetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SetupError';
  }
}

export async function readTextIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export async function isSymlink(path: string): Promise<boolean> {
  return lstat(path).then(
    (info) => info.isSymbolicLink(),
    () => false,
  );
}

// Write next to the target, then rename, so a crash never leaves a half-written file.
// Refuses a symlinked target: replacing it would silently change a shared file elsewhere.
// `mode` applies to a newly written file (the umask may narrow it further).
export async function writeFileAtomic(path: string, content: string, mode?: number): Promise<void> {
  if (await isSymlink(path)) throw new SetupError(`${path} is a symlink; edit it by hand`);
  const temp = join(dirname(path), `.${basename(path)}.${randomBytes(6).toString('hex')}.tmp`);
  await writeFile(temp, content, { flag: 'wx', ...(mode === undefined ? {} : { mode }) });
  try {
    await rename(temp, path);
  } catch (error) {
    await unlink(temp).catch(() => undefined);
    throw error;
  }
}

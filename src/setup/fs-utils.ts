import { readFile, rename, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

export async function readTextIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

// Write next to the target, then rename, so a crash never leaves a half-written file.
export async function writeFileAtomic(path: string, content: string): Promise<void> {
  const temp = join(dirname(path), `.${basename(path)}.${process.pid}.tmp`);
  await writeFile(temp, content);
  await rename(temp, path);
}

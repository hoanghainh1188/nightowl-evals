import { appendFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DATA_DIR } from '../storage/store.js';

export const ERROR_LOG_FILE = 'nightowl.log';
export const MAX_ERROR_LOG_BYTES = 1024 * 1024;

function describe(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const code = (error as NodeJS.ErrnoException).code;
  return code ? `${error.name} ${code}: ${error.message}` : `${error.name}: ${error.message}`;
}

// Hooks report problems here instead of stderr. Callers pass short descriptions, never
// payloads, code or prompts. Never throws: a broken log must not break the hook.
export async function appendErrorLog(root: string, hook: string, error: unknown): Promise<void> {
  try {
    const dir = join(root, DATA_DIR);
    const file = join(dir, ERROR_LOG_FILE);
    const line = `${new Date().toISOString()} ${hook} ${describe(error).replace(/\s*\n\s*/g, ' ')}\n`;
    await mkdir(dir, { recursive: true });
    const size = await stat(file).then((info) => info.size, () => 0);
    if (size > MAX_ERROR_LOG_BYTES) await writeFile(file, line);
    else await appendFile(file, line);
  } catch {
    // Nowhere left to report to.
  }
}

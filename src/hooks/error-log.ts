import { appendFile, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { ensureDataDir } from '../storage/data-dir.js';

export const ERROR_LOG_FILE = 'nightowl.log';
export const MAX_ERROR_LOG_BYTES = 1024 * 1024;
const MAX_MESSAGE_CHARS = 200;

function describe(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const code = (error as NodeJS.ErrnoException).code;
  return code ? `${error.name} ${code}: ${error.message}` : `${error.name}: ${error.message}`;
}

// One line, no home directory (it carries the user name), bounded length.
function sanitise(message: string): string {
  const oneLine = message.replace(/\s*\n\s*/g, ' ').replaceAll(homedir(), '~');
  return oneLine.length > MAX_MESSAGE_CHARS ? `${oneLine.slice(0, MAX_MESSAGE_CHARS)}…` : oneLine;
}

// Hooks report problems here instead of stderr. Callers pass short descriptions, never
// payloads, code or prompts. Never throws: a broken log must not break the hook.
export async function appendErrorLog(root: string, hook: string, error: unknown): Promise<void> {
  try {
    const file = join(ensureDataDir(root), ERROR_LOG_FILE);
    const line = `${new Date().toISOString()} ${hook} ${sanitise(describe(error))}\n`;
    const size = await stat(file).then((info) => info.size, () => 0);
    if (size > MAX_ERROR_LOG_BYTES) await writeFile(file, line);
    else await appendFile(file, line);
  } catch {
    // Nowhere left to report to.
  }
}

import { readFile } from 'node:fs/promises';
import { isRecord } from '../shared/claude-answer.js';

export const MAX_EVAL_FILE_BYTES = 64 * 1024;
const SCHEMA_PREFIX = 'nightowl.eval/v1';

export interface EvalCase {
  readonly id: string;
  readonly filePath: string;
  readonly prompt: string;
  readonly fileBefore: string | null;
  readonly rejected: string;
  readonly expected: string;
}

export interface LoadedCases {
  readonly cases: readonly EvalCase[];
  readonly invalid: number;
  readonly noPrompt: number;
  readonly tooLarge: number;
}

type Parsed = EvalCase | 'invalid' | 'no-prompt' | 'too-large';

function parseLine(line: string): Parsed {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return 'invalid';
  }
  if (!isRecord(value) || typeof value.schema !== 'string' || !value.schema.startsWith(SCHEMA_PREFIX)) return 'invalid';
  const { id, file_path: filePath, input, rejected, expected } = value;
  if (typeof id !== 'string' || typeof filePath !== 'string' || typeof rejected !== 'string' || typeof expected !== 'string') {
    return 'invalid';
  }
  if (!isRecord(input)) return 'invalid';
  const { prompt, file_before: fileBefore } = input;
  if (fileBefore !== null && typeof fileBefore !== 'string') return 'invalid';
  if (typeof prompt !== 'string' || prompt.trim() === '') return 'no-prompt';
  if (fileBefore !== null && Buffer.byteLength(fileBefore) > MAX_EVAL_FILE_BYTES) return 'too-large';
  return Object.freeze({ id, filePath, prompt, fileBefore, rejected, expected });
}

export function parseCases(text: string): LoadedCases {
  const parsed = text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map(parseLine);
  return Object.freeze({
    cases: Object.freeze(parsed.filter((p): p is EvalCase => typeof p !== 'string')),
    invalid: parsed.filter((p) => p === 'invalid').length,
    noPrompt: parsed.filter((p) => p === 'no-prompt').length,
    tooLarge: parsed.filter((p) => p === 'too-large').length,
  });
}

// Throws ENOENT when the suite has not been exported yet.
export async function loadCases(path: string): Promise<LoadedCases> {
  return parseCases(await readFile(path, 'utf8'));
}

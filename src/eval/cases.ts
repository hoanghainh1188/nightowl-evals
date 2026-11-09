import { readFile, stat } from 'node:fs/promises';
import { containsInlineSecret, isSensitivePath } from '../hooks/claude-code/sensitive.js';
import { isRecord } from '../shared/claude-answer.js';
import { hasScorableChange } from './score.js';

export const MAX_EVAL_FILE_BYTES = 64 * 1024;
export const MAX_PROMPT_BYTES = 64 * 1024;
export const MAX_SUITE_BYTES = 32 * 1024 * 1024;
const MAX_PATH_BYTES = 4 * 1024;
const SCHEMA_PREFIX = 'nightowl.eval/v1';

export interface EvalCase {
  readonly id: string;
  readonly filePath: string;
  readonly prompt: string;
  readonly fileBefore: string | null;
  readonly rejected: string;
  readonly expected: string;
}

export type SkipReason = 'invalid' | 'duplicate' | 'no-prompt' | 'too-large' | 'sensitive' | 'no-change';

export interface LoadedCases {
  readonly cases: readonly EvalCase[];
  readonly skipped: Readonly<Record<SkipReason, number>>;
}

export class SuiteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SuiteError';
  }
}

function parseLine(line: string): EvalCase | SkipReason {
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
  // Never sent, even from a hand-edited suite: same rule as the hook and export.
  if (
    isSensitivePath(filePath) ||
    containsInlineSecret(rejected) ||
    containsInlineSecret(expected) ||
    containsInlineSecret(fileBefore)
  ) {
    return 'sensitive';
  }
  if (typeof prompt !== 'string' || prompt.trim() === '') return 'no-prompt';
  const tooLarge =
    Buffer.byteLength(prompt) > MAX_PROMPT_BYTES ||
    Buffer.byteLength(filePath) > MAX_PATH_BYTES ||
    (fileBefore !== null && Buffer.byteLength(fileBefore) > MAX_EVAL_FILE_BYTES);
  if (tooLarge) return 'too-large';
  // With no line added or removed, any output would pass.
  if (!hasScorableChange(rejected, expected)) return 'no-change';
  return Object.freeze({ id, filePath, prompt, fileBefore, rejected, expected });
}

export function parseCases(text: string): LoadedCases {
  const skipped: Record<SkipReason, number> = {
    invalid: 0,
    duplicate: 0,
    'no-prompt': 0,
    'too-large': 0,
    sensitive: 0,
    'no-change': 0,
  };
  const cases: EvalCase[] = [];
  const seen = new Set<string>();
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    const parsed = parseLine(line);
    if (typeof parsed === 'string') skipped[parsed] += 1;
    else if (seen.has(parsed.id)) skipped.duplicate += 1;
    else {
      seen.add(parsed.id);
      cases.push(parsed);
    }
  }
  return Object.freeze({ cases: Object.freeze(cases), skipped: Object.freeze(skipped) });
}

// Throws ENOENT when the suite has not been exported yet, SuiteError for anything unsafe to read.
export async function loadCases(path: string): Promise<LoadedCases> {
  const info = await stat(path);
  if (!info.isFile()) throw new SuiteError('the suite is not a regular file');
  if (info.size > MAX_SUITE_BYTES) throw new SuiteError('the suite is larger than 32 MB');
  return parseCases(await readFile(path, 'utf8'));
}

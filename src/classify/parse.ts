import { readClaudeAnswer } from '../shared/claude-answer.js';
import { CATEGORIES, type Category } from './prompt.js';

export const MAX_REASON_CHARS = 300;

export interface Classification {
  readonly category: Category;
  readonly reason: string;
  readonly confidence: number;
}

export type ParseResult = { readonly ok: true; readonly value: Classification } | { readonly ok: false; readonly error: string };

export const CLASSIFICATION_SCHEMA = Object.freeze({
  type: 'object',
  required: ['category', 'reason', 'confidence'],
  additionalProperties: false,
  properties: {
    category: { enum: Object.keys(CATEGORIES) },
    reason: { type: 'string', maxLength: MAX_REASON_CHARS },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
});

// Never trusts the LLM: anything off-schema is rejected, nothing is coerced.
export function parseClaudeOutput(stdout: string): ParseResult {
  const read = readClaudeAnswer(stdout, 'classification');
  if (!read.ok) return read;
  const { category, reason, confidence } = read.answer;
  if (typeof category !== 'string' || !Object.hasOwn(CATEGORIES, category)) return { ok: false, error: 'unknown category' };
  if (typeof reason !== 'string' || reason.trim() === '') return { ok: false, error: 'missing reason' };
  if (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    return { ok: false, error: 'confidence is not between 0 and 1' };
  }
  return {
    ok: true,
    value: Object.freeze({ category: category as Category, reason: reason.trim().slice(0, MAX_REASON_CHARS), confidence }),
  };
}

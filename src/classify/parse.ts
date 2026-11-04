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

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// The answer is in `structured_output` when --json-schema is honoured, else maybe as JSON text in `result`.
function findAnswer(envelope: Record<string, unknown>): unknown {
  if (isRecord(envelope.structured_output)) return envelope.structured_output;
  if (typeof envelope.result !== 'string') return undefined;
  const fenced = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/.exec(envelope.result);
  return parseJson(fenced ? (fenced[1] as string) : envelope.result);
}

// Never trusts the LLM: anything off-schema is rejected, nothing is coerced.
export function parseClaudeOutput(stdout: string): ParseResult {
  const envelope = parseJson(stdout);
  if (!isRecord(envelope)) return { ok: false, error: 'claude output is not a JSON object' };
  if (envelope.is_error === true) return { ok: false, error: 'claude reported an error' };
  const answer = findAnswer(envelope);
  if (!isRecord(answer)) return { ok: false, error: 'no classification in claude output' };

  const { category, reason, confidence } = answer;
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

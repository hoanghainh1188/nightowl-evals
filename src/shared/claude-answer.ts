export type AnswerResult =
  | { readonly ok: true; readonly answer: Readonly<Record<string, unknown>> }
  | { readonly ok: false; readonly error: string };

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// The answer is in `structured_output` when --json-schema is honoured, else maybe as JSON text in `result`.
function findAnswer(envelope: Record<string, unknown>): unknown {
  if (isRecord(envelope.structured_output)) return envelope.structured_output;
  if (typeof envelope.result !== 'string') return undefined;
  const fenced = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/.exec(envelope.result);
  return parseJson(fenced ? (fenced[1] as string) : envelope.result);
}

// Extracts the JSON answer object from `claude -p --output-format json` output. Callers
// still validate every field: the answer comes from an LLM.
export function readClaudeAnswer(stdout: string, what: string): AnswerResult {
  const envelope = parseJson(stdout);
  if (!isRecord(envelope)) return { ok: false, error: 'claude output is not a JSON object' };
  if (envelope.is_error === true) return { ok: false, error: 'claude reported an error' };
  const answer = findAnswer(envelope);
  return isRecord(answer) ? { ok: true, answer } : { ok: false, error: `no ${what} in claude output` };
}

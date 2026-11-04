import type { FailureToExport } from '../storage/failures.js';

export const EVAL_SCHEMA = 'nightowl.eval/v1';
export const REFERENCE_CRITERIA = Object.freeze({
  type: 'reference',
  description: 'The output should match the intent of `expected` and must not repeat the defect in `rejected`.',
});

export interface EvalCase {
  readonly schema: typeof EVAL_SCHEMA;
  readonly id: string;
  readonly file_path: string;
  readonly commit_sha: string | null;
  readonly created_at: string;
  readonly input: { readonly prompt: string | null; readonly file_before: string | null };
  readonly rejected: string;
  readonly expected: string;
  readonly category: string | null;
  readonly category_reason: string | null;
  readonly category_confidence: number | null;
  readonly criteria: typeof REFERENCE_CRITERIA;
}

// Stable across exports: derived from the commit and the file, made unique in export order.
export function evalIds(failures: readonly FailureToExport[]): readonly string[] {
  const used = new Set<string>();
  return failures.map((failure) => {
    const base = failure.commitSha === null ? `failure-${failure.id}` : `${failure.commitSha.slice(0, 12)}-${failure.filePath}`;
    const id = used.has(base) ? `${base}-${failure.id}` : base;
    used.add(id);
    return id;
  });
}

// Keys are written in this order, so the same failure always gives the same line.
export function toEvalCase(failure: FailureToExport, id: string, fileBefore: string | null): EvalCase {
  return {
    schema: EVAL_SCHEMA,
    id,
    file_path: failure.filePath,
    commit_sha: failure.commitSha,
    created_at: failure.createdAt,
    input: { prompt: failure.prompt, file_before: fileBefore },
    rejected: failure.aiContent,
    expected: failure.finalContent,
    category: failure.category,
    category_reason: failure.categoryReason,
    category_confidence: failure.categoryConfidence,
    criteria: REFERENCE_CRITERIA,
  };
}

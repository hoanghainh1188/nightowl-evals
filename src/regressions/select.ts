import { evalId, toEvalCase, type EvalCase } from '../export/eval-case.js';
import { containsInlineSecret, isSensitivePath } from '../hooks/claude-code/sensitive.js';
import type { FailureSource } from '../storage/failures.js';
import type { FailureForRegression, RegressionScaffold } from './types.js';

export interface SelectedRegressions {
  readonly scaffolds: readonly RegressionScaffold[];
  readonly skippedSensitive: number;
}

function titleFor(failure: FailureForRegression, id: string): string {
  const category = failure.category ?? 'unclassified';
  return `Regression ${id}: ${category} in ${failure.filePath}`;
}

function descriptionFor(failure: FailureForRegression): string {
  const reason = failure.categoryReason?.trim();
  if (reason) return reason;
  return `AI output was corrected by the developer (${failure.source}). Review before enabling assertions.`;
}

export function selectRegressionScaffolds(
  failures: readonly FailureForRegression[],
  fileBefore: ReadonlyMap<string, string | null>,
): SelectedRegressions {
  const scaffolds: RegressionScaffold[] = [];
  let skippedSensitive = 0;
  for (const failure of failures) {
    if (
      isSensitivePath(failure.filePath) ||
      containsInlineSecret(failure.aiContent) ||
      containsInlineSecret(failure.finalContent) ||
      containsInlineSecret(failure.prompt) ||
      containsInlineSecret(failure.feedback)
    ) {
      skippedSensitive += 1;
      continue;
    }
    const exportShape = {
      id: failure.id,
      createdAt: failure.createdAt,
      filePath: failure.filePath,
      commitSha: failure.commitSha,
      prompt: failure.prompt,
      aiContent: failure.aiContent,
      finalContent: failure.finalContent,
      category: failure.category,
      categoryReason: failure.categoryReason,
      categoryConfidence: failure.categoryConfidence,
      source: failure.source as FailureSource,
      feedback: failure.feedback,
    };
    const id = evalId(exportShape);
    const key = failure.commitSha === null ? null : `${failure.commitSha}\0${failure.filePath}`;
    const before = key === null ? null : (fileBefore.get(key) ?? null);
    if (before !== null && containsInlineSecret(before)) {
      skippedSensitive += 1;
      continue;
    }
    const evalCase: EvalCase = toEvalCase(exportShape, id, before);
    scaffolds.push(
      Object.freeze({
        id,
        title: titleFor(failure, id),
        description: descriptionFor(failure),
        evalCase,
        source: 'heuristic' as const,
      }),
    );
  }
  return Object.freeze({ scaffolds: Object.freeze(scaffolds), skippedSensitive });
}

import type { FailureToExport } from '../storage/failures.js';
import { containsInlineSecret, isSensitivePath } from '../hooks/claude-code/sensitive.js';
import {
  applyPrivacy,
  coarsenPath,
  countEmailsIn,
  countSecretsIn,
  emptyPrivacyCounts,
  type PrivacyCounts,
  wouldCoarsenPath,
} from './redact.js';

function redactNullable(text: string | null): string | null {
  return text === null ? null : applyPrivacy(text);
}

/** True when export `prepare()` would drop this failure entirely. */
function wouldSkipFailure(failure: FailureToExport): boolean {
  return (
    isSensitivePath(failure.filePath) ||
    containsInlineSecret(failure.aiContent) ||
    containsInlineSecret(failure.finalContent)
  );
}

/** Redact text fields on a failure (+ optional file_before) before any export formatter. */
export function privatizeFailureExport(
  failure: FailureToExport,
  fileBefore: string | null,
  redactPaths: boolean,
): { readonly failure: FailureToExport; readonly fileBefore: string | null } {
  return {
    failure: {
      ...failure,
      filePath: redactPaths ? coarsenPath(failure.filePath) : failure.filePath,
      prompt: redactNullable(failure.prompt),
      aiContent: applyPrivacy(failure.aiContent),
      finalContent: applyPrivacy(failure.finalContent),
      feedback: redactNullable(failure.feedback),
      categoryReason: redactNullable(failure.categoryReason),
    },
    fileBefore: redactNullable(fileBefore),
  };
}

export function scanFailurePrivacy(failure: FailureToExport, redactPaths: boolean): PrivacyCounts {
  // Match export prepare(): sensitive path or inline secret in body → skip, do not count as redact hits.
  if (wouldSkipFailure(failure)) {
    return emptyPrivacyCounts(1);
  }
  const texts = [failure.aiContent, failure.finalContent, failure.prompt ?? '', failure.feedback ?? '', failure.categoryReason ?? ''];
  let secrets = 0;
  let emails = 0;
  for (const text of texts) {
    secrets += countSecretsIn(text);
    emails += countEmailsIn(text);
  }
  const paths = redactPaths && wouldCoarsenPath(failure.filePath) ? 1 : 0;
  return Object.freeze({ secrets, emails, paths, skippedSensitive: 0 });
}

export function scanFailuresPrivacy(
  failures: readonly FailureToExport[],
  redactPaths: boolean,
): PrivacyCounts {
  return failures.reduce(
    (acc, failure) => {
      const next = scanFailurePrivacy(failure, redactPaths);
      return Object.freeze({
        secrets: acc.secrets + next.secrets,
        emails: acc.emails + next.emails,
        paths: acc.paths + next.paths,
        skippedSensitive: acc.skippedSensitive + next.skippedSensitive,
      });
    },
    emptyPrivacyCounts(),
  );
}

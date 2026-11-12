export {
  REDACTED_MARKER,
  addCounts,
  applyPrivacy,
  coarsenPath,
  countEmailsIn,
  countSecretsIn,
  emptyPrivacyCounts,
  formatPrivacyDryRun,
  redactEmails,
  redactSecrets,
  wouldCoarsenPath,
  type PrivacyCounts,
  type PrivacyTextOptions,
} from './redact.js';
export { redactPathsInReport } from './report.js';

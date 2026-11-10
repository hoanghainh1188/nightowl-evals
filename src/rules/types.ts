export type FailureStatus = 'flagged' | 'confirmed' | 'dismissed';

export interface RulesFilter {
  readonly since: string | null;
  readonly statuses: readonly FailureStatus[];
  readonly categories: readonly string[];
  readonly agents: readonly string[] | null;
}

export interface FailureForRules {
  readonly id: number;
  readonly filePath: string;
  readonly category: string | null;
  readonly status: FailureStatus;
  readonly agent: string | null;
  readonly aiContent: string;
  readonly finalContent: string;
  readonly categoryReason: string | null;
}

export interface RuleCluster {
  readonly key: string;
  readonly category: string;
  readonly module: string;
  readonly agent: string | null;
  readonly count: number;
  readonly sampleIds: readonly number[];
  readonly samplePaths: readonly string[];
  readonly reasonHints: readonly string[];
  readonly snippet: string | null;
}

export interface SuggestedRule {
  readonly title: string;
  readonly body: string;
  readonly cluster: RuleCluster;
  readonly source: 'heuristic' | 'llm';
}

/** @deprecated Legacy single-line marker; prefer RULES_MARKER_START / RULES_MARKER_END. */
export const RULES_MARKER = '<!-- nightowl-suggested-rules -->';
export const RULES_MARKER_START = '<!-- nightowl-suggested-rules:start -->';
export const RULES_MARKER_END = '<!-- nightowl-suggested-rules:end -->';
export const DEFAULT_MIN_COUNT = 2;
export const DEFAULT_DEPTH = 2;
export const DEFAULT_CATEGORIES = Object.freeze(['convention', 'missing-context'] as const);
export const DEFAULT_STATUSES = Object.freeze(['confirmed'] as const) satisfies readonly FailureStatus[];

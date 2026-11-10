import type { EvalCase } from '../export/eval-case.js';

export type FailureStatus = 'flagged' | 'confirmed' | 'dismissed';
export type RegressionFramework = 'json' | 'vitest' | 'jest';

export interface RegressionFilter {
  readonly since: string | null;
  readonly statuses: readonly FailureStatus[];
  readonly categories: readonly string[] | null;
  readonly agents: readonly string[] | null;
  readonly limit: number;
}

export interface FailureForRegression {
  readonly id: number;
  readonly createdAt: string;
  readonly filePath: string;
  readonly commitSha: string | null;
  readonly prompt: string | null;
  readonly aiContent: string;
  readonly finalContent: string;
  readonly category: string | null;
  readonly categoryReason: string | null;
  readonly categoryConfidence: number | null;
  readonly source: string;
  readonly feedback: string | null;
  readonly status: FailureStatus;
  readonly agent: string | null;
}

export interface RegressionScaffold {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly evalCase: EvalCase;
  readonly source: 'heuristic' | 'llm';
}

export const REGRESSION_MARKER = '// nightowl-suggested-regression';
export const DEFAULT_STATUSES = Object.freeze(['confirmed'] as const) satisfies readonly FailureStatus[];
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

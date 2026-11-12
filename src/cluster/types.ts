export const CLUSTER_SEP = '|';
export const FINGERPRINT_HEX_LEN = 16;
export const DEFAULT_CLUSTER_MIN_COUNT = 2;
export const DEFAULT_CLUSTER_LIMIT = 10;
export const DEFAULT_CLUSTER_DEPTH = 2;

export interface ClusterableFailure {
  readonly id: number;
  readonly filePath: string;
  readonly category: string | null;
  readonly agent: string | null;
  readonly aiContent: string;
  readonly finalContent: string;
  readonly status?: string;
}

export interface FailureCluster {
  readonly key: string;
  readonly category: string;
  readonly module: string;
  readonly agent: string | null;
  readonly fingerprint: string;
  readonly count: number;
  readonly sampleIds: readonly number[];
  readonly samplePaths: readonly string[];
}

export interface GroupFailuresOptions {
  readonly minCount?: number;
  readonly depth?: number;
  readonly limit?: number;
  /** When true (default for report), skip status === 'dismissed'. */
  readonly excludeDismissed?: boolean;
}

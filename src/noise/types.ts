export const NOISE_REASONS = Object.freeze(['comment-only', 'format-only', 'learned-dismiss', 'auto-noise'] as const);
export type NoiseReason = (typeof NOISE_REASONS)[number];

export interface NoiseStatRow {
  readonly reasonKey: string;
  readonly dismissCount: number;
  readonly confirmCount: number;
}

export interface NoiseScore {
  readonly score: number;
  readonly reasons: readonly NoiseReason[];
}

export interface NoiseDecision {
  readonly status: 'flagged' | 'dismissed';
  readonly score: number;
  readonly reasons: readonly NoiseReason[];
}

export interface ReportNoise {
  readonly reviewRate: number | null;
  readonly autoNoise: number;
  readonly sample: { readonly confirmed: number; readonly dismissed: number };
}

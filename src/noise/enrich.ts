import { decideNoiseStatus, formatNoiseReasons } from './decide.js';
import { scoreNoise } from './score.js';
import type { NoiseStatRow } from './types.js';

export interface NoiseEnrichable {
  readonly filePath: string;
  readonly aiContent: string;
  readonly finalContent: string;
  readonly status?: 'flagged' | 'dismissed';
  readonly noiseScore?: number | null;
  readonly noiseReasons?: string;
}

/** Attach noise score/reasons/status onto a new failure payload. */
export function enrichFailureNoise<T extends NoiseEnrichable>(
  failure: T,
  stats: readonly NoiseStatRow[] = [],
): T & { status: 'flagged' | 'dismissed'; noiseScore: number; noiseReasons: string } {
  const scored = scoreNoise(failure.aiContent, failure.finalContent, failure.filePath, stats);
  const decision = decideNoiseStatus(scored);
  return {
    ...failure,
    status: decision.status,
    noiseScore: decision.score,
    noiseReasons: formatNoiseReasons(decision.reasons),
  };
}

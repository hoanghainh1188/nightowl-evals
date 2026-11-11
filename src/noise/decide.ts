import { NOISE_REASONS, type NoiseDecision, type NoiseReason, type NoiseScore } from './types.js';

const SAFE_AUTO = new Set<NoiseReason>(['comment-only']);

export function isSafeAutoNoise(reasons: readonly NoiseReason[]): boolean {
  return reasons.some((r) => SAFE_AUTO.has(r));
}

/** Safe patterns become dismissed with an explicit auto-noise reason; others stay flagged. */
export function decideNoiseStatus(scored: NoiseScore): NoiseDecision {
  if (isSafeAutoNoise(scored.reasons)) {
    const reasons = Object.freeze([...scored.reasons.filter((r) => r !== 'auto-noise'), 'auto-noise' as const]);
    return { status: 'dismissed', score: scored.score, reasons };
  }
  return { status: 'flagged', score: scored.score, reasons: scored.reasons };
}

export function formatNoiseReasons(reasons: readonly NoiseReason[]): string {
  return reasons.join(',');
}

export function parseNoiseReasons(text: string): readonly NoiseReason[] {
  const known = new Set<string>(NOISE_REASONS);
  return text
    .split(',')
    .map((part) => part.trim())
    .filter((part): part is NoiseReason => known.has(part));
}

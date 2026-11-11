import { stripComments, stripFormatNoise, stripWhitespace } from './strip.js';
import type { NoiseReason, NoiseScore, NoiseStatRow } from './types.js';

const LEARNED_CAP = 0.25;
const LEARNED_WEIGHT = 0.35;
const COMMENT_SCORE = 0.9;
const FORMAT_SCORE = 0.55;

function learnedBoost(stats: readonly NoiseStatRow[], reasonKey: string): number {
  const row = stats.find((s) => s.reasonKey === reasonKey);
  if (row === undefined) return 0;
  const total = row.dismissCount + row.confirmCount;
  if (total === 0) return 0;
  const rate = row.dismissCount / (total + 1);
  return Math.min(LEARNED_CAP, LEARNED_WEIGHT * rate);
}

/** Deterministic noise score from AI vs committed content (+ optional local stats). */
export function scoreNoise(
  aiContent: string,
  finalContent: string,
  filePath: string,
  stats: readonly NoiseStatRow[] = [],
): NoiseScore {
  if (aiContent === finalContent) {
    return { score: 0, reasons: [] };
  }

  const reasons: NoiseReason[] = [];
  let score = 0;

  const aiCode = stripWhitespace(stripComments(aiContent, filePath));
  const finalCode = stripWhitespace(stripComments(finalContent, filePath));
  const commentOnly = aiCode === finalCode && stripWhitespace(aiContent) !== stripWhitespace(finalContent);

  if (commentOnly) {
    reasons.push('comment-only');
    score = Math.max(score, COMMENT_SCORE);
  } else if (stripFormatNoise(aiContent) === stripFormatNoise(finalContent)) {
    reasons.push('format-only');
    score = Math.max(score, FORMAT_SCORE);
  }

  const primary = reasons[0];
  if (primary !== undefined) {
    const boost = learnedBoost(stats, primary);
    if (boost > 0) {
      reasons.push('learned-dismiss');
      score = Math.min(1, score + boost);
    }
  }

  return { score, reasons: Object.freeze(reasons) };
}

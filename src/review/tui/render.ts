import { unifiedDiff } from '../../classify/diff.js';
import type { FailureForReview } from '../../storage/review-queries.js';
import { MAX_DIFF_LINE_CHARS, terminalSafe } from '../format.js';
import {
  BOLD,
  CLEAR_SCREEN,
  DIM,
  HIDE_CURSOR,
  INVERSE,
  RESET,
  colorDiffLine,
} from './ansi.js';

export interface TuiViewState {
  readonly items: readonly FailureForReview[];
  readonly index: number;
  readonly showDiff: boolean;
  readonly statusLabel: string | null;
  readonly message: string | null;
  readonly rows: number;
  readonly columns: number;
}

const HINTS = '↑/↓ move · Space/Enter diff · c confirm · d dismiss · r reset · q quit';

function clip(text: string, width: number): string {
  const chars = [...text];
  if (chars.length <= width) return text;
  if (width <= 1) return chars.slice(0, Math.max(0, width)).join('');
  return `${chars.slice(0, width - 1).join('')}…`;
}

function listLine(failure: FailureForReview, selected: boolean, width: number): string {
  const body = terminalSafe(
    `#${failure.id}  ${failure.status.padEnd(10)}  ${(failure.category ?? 'unclassified').padEnd(16)}  ${failure.filePath}`,
  );
  const line = clip(body, Math.max(8, width - 2));
  return selected ? `${INVERSE} ${line} ${RESET}` : `  ${line}`;
}

function diffLines(failure: FailureForReview, maxLines: number, width: number): readonly string[] {
  const diff = unifiedDiff(failure.aiContent, failure.finalContent);
  if (diff === null) return [DIM + '  (diff too large)' + RESET];
  const raw = diff
    .split('\n')
    .slice(2)
    .filter((line, i, all) => line !== '' || i < all.length - 1)
    .slice(0, maxLines);
  if (raw.length === 0) return [DIM + '  (no difference)' + RESET];
  return raw.map((line) => {
    const safe = terminalSafe(line);
    const chars = [...safe];
    const cut = chars.length > MAX_DIFF_LINE_CHARS ? `${chars.slice(0, MAX_DIFF_LINE_CHARS).join('')}…` : safe;
    return clip(`  ${colorDiffLine(cut)}`, width);
  });
}

export function renderFrame(state: TuiViewState): string {
  const width = Math.max(40, state.columns);
  const rows = Math.max(12, state.rows);
  const lines: string[] = [];
  const filter = state.statusLabel === null ? 'all' : state.statusLabel;
  lines.push(`${BOLD}nightowl review${RESET}  ${DIM}filter=${filter}  ${state.items.length} items${RESET}`);
  lines.push(`${DIM}${HINTS}${RESET}`);
  if (state.message) lines.push(state.message);
  lines.push('');

  if (state.items.length === 0) {
    lines.push(DIM + 'No failures match this filter.' + RESET);
  } else {
    const listBudget = state.showDiff ? Math.max(3, Math.floor(rows / 3)) : Math.max(5, rows - 6);
    const start = Math.max(0, Math.min(state.index - Math.floor(listBudget / 2), state.items.length - listBudget));
    const end = Math.min(state.items.length, start + listBudget);
    for (let i = start; i < end; i += 1) {
      lines.push(listLine(state.items[i]!, i === state.index, width));
    }
    if (state.showDiff) {
      lines.push('');
      lines.push(`${BOLD}Diff #${state.items[state.index]!.id}${RESET}`);
      const remaining = Math.max(4, rows - lines.length - 2);
      lines.push(...diffLines(state.items[state.index]!, remaining, width));
    }
  }

  return `${CLEAR_SCREEN}${HIDE_CURSOR}${lines.join('\n')}\n`;
}

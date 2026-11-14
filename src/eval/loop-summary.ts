import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DATA_DIR } from '../storage/store.js';
import { printable } from '../shared/printable.js';
import { aggregateModels, parseRunFile, type ParsedRunFile } from './compare.js';

/** Must match `RUNS_DIR` in the eval command. */
const RUNS_DIR = 'runs';

export type EvalLoopView =
  | { readonly kind: 'none' }
  | { readonly kind: 'na'; readonly reason?: string }
  | {
      readonly kind: 'ok';
      readonly label: string | null;
      readonly baselineLabel: string | null;
      readonly oneLine: string;
    };

interface RankedRun {
  readonly path: string;
  readonly runAt: string;
  readonly parsed: ParsedRunFile;
}

function meanLine(parsed: ParsedRunFile): string {
  const models = aggregateModels(parsed.rows);
  if (models.length === 0) return 'no scored rows';
  const parts = models.map((m) => {
    const mean = m.meanScore === null ? 'n/a' : m.meanScore.toFixed(2);
    return `${m.model} pass ${m.passed}/${m.scored} mean ${mean}`;
  });
  return parts.join('; ');
}

function deltaLine(current: ParsedRunFile, baseline: ParsedRunFile): string {
  const cur = aggregateModels(current.rows);
  const base = new Map(aggregateModels(baseline.rows).map((m) => [m.model, m]));
  const parts: string[] = [];
  for (const m of cur) {
    const b = base.get(m.model);
    if (b === undefined || m.meanScore === null || b.meanScore === null) {
      parts.push(`${m.model} pass ${m.passed}/${m.scored}`);
      continue;
    }
    const dPass = m.passed - b.passed;
    const dMean = m.meanScore - b.meanScore;
    const sign = dPass > 0 ? '+' : '';
    parts.push(`${m.model} pass ${sign}${dPass}, mean ${dMean >= 0 ? '+' : ''}${dMean.toFixed(2)}`);
  }
  return parts.length === 0 ? meanLine(current) : `vs prior: ${parts.join('; ')}`;
}

async function loadRuns(runsDir: string): Promise<readonly RankedRun[]> {
  let names: string[];
  try {
    names = await readdir(runsDir);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return [];
    throw error;
  }
  const ranked: RankedRun[] = [];
  for (const name of names) {
    if (!name.endsWith('.jsonl')) continue;
    const path = join(runsDir, name);
    try {
      const parsed = parseRunFile(await readFile(path, 'utf8'));
      if (parsed.rows.length === 0 && parsed.meta === null) continue;
      const runAt = parsed.meta?.run_at || name;
      ranked.push({ path, runAt, parsed });
    } catch {
      // skip corrupt files
    }
  }
  return ranked.sort((a, b) => (a.runAt < b.runAt ? 1 : a.runAt > b.runAt ? -1 : 0));
}

/** Summarize latest eval run under `<projectRoot>/.nightowl/runs/` (fail-open). */
export async function resolveEvalLoopSummary(projectRoot: string): Promise<EvalLoopView> {
  const runsDir = join(projectRoot, DATA_DIR, RUNS_DIR);
  let ranked: readonly RankedRun[];
  try {
    ranked = await loadRuns(runsDir);
  } catch {
    return Object.freeze({ kind: 'na', reason: 'read failed' });
  }
  if (ranked.length === 0) return Object.freeze({ kind: 'none' });
  const latest = ranked[0]!;
  const previous = ranked[1];
  const label = latest.parsed.meta?.label ?? null;
  const baselineLabel = previous?.parsed.meta?.label ?? null;
  const detail =
    previous === undefined ? meanLine(latest.parsed) : deltaLine(latest.parsed, previous.parsed);
  const labelPart = label === null ? 'unlabeled' : printable(label);
  return Object.freeze({
    kind: 'ok',
    label,
    baselineLabel,
    oneLine: `${labelPart}; ${detail}`,
  });
}

export function formatEvalLoopLine(view: EvalLoopView): string {
  if (view.kind === 'none') return 'Eval loop: none recorded';
  if (view.kind === 'na') return 'Eval loop: n/a';
  return `Eval loop: ${view.oneLine}`;
}

import { printable } from '../shared/printable.js';

export const RUN_META_SCHEMA = 'nightowl.eval-run-meta/v1' as const;
export const DEFAULT_COMPARE_HTML_RELATIVE = '.nightowl/eval-compare.html';
export const MAX_COMPARE_DIFFERENCES = 20;
/** Labels for prompt/rules experiments: short, shell-safe. */
export const EVAL_LABEL_PATTERN = /^[\w./:@+-]{1,64}$/;

export interface RunMeta {
  readonly schema: typeof RUN_META_SCHEMA;
  readonly label: string | null;
  readonly models: readonly string[];
  readonly run_at: string;
}

export interface RunResultRow {
  readonly run_at: string;
  readonly case_id: string;
  readonly model: string;
  readonly coverage: number | null;
  readonly repeat: number | null;
  readonly score: number | null;
  readonly pass: boolean | null;
  readonly tests_passed: boolean | null;
  readonly error: string | null;
}

export interface ParsedRunFile {
  readonly meta: RunMeta | null;
  readonly rows: readonly RunResultRow[];
}

export interface ModelStats {
  readonly model: string;
  readonly scored: number;
  readonly passed: number;
  readonly meanScore: number | null;
  readonly failedCalls: number;
  readonly testsOk: number | null;
  readonly tested: number | null;
}

export interface ModelDelta {
  readonly model: string;
  readonly passedDelta: number | null;
  readonly meanScoreDelta: number | null;
}

export interface CompareReport {
  readonly label: string | null;
  readonly baselineLabel: string | null;
  readonly models: readonly ModelStats[];
  readonly deltas: readonly ModelDelta[] | null;
  readonly disagreements: readonly string[];
  readonly ruleNote: string;
  readonly withTests: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asNullableBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function parseMeta(value: unknown): RunMeta | null {
  if (!isRecord(value) || value.schema !== RUN_META_SCHEMA) return null;
  const label = value.label === null || value.label === undefined ? null : String(value.label);
  const models = Array.isArray(value.models) ? value.models.map(String) : [];
  const run_at = typeof value.run_at === 'string' ? value.run_at : '';
  return { schema: RUN_META_SCHEMA, label, models, run_at };
}

function parseRow(value: unknown): RunResultRow | null {
  if (!isRecord(value)) return null;
  if (typeof value.case_id !== 'string' || typeof value.model !== 'string') return null;
  if (typeof value.run_at !== 'string') return null;
  return {
    run_at: value.run_at,
    case_id: value.case_id,
    model: value.model,
    coverage: asNullableNumber(value.coverage),
    repeat: asNullableNumber(value.repeat),
    score: asNullableNumber(value.score),
    pass: asNullableBoolean(value.pass),
    tests_passed: asNullableBoolean(value.tests_passed),
    error: value.error === null || value.error === undefined ? null : String(value.error),
  };
}

/** Parse a NightOwl eval run JSONL (optional meta first line + result rows). */
export function parseRunFile(text: string): ParsedRunFile {
  const lines = text.split('\n').filter((line) => line.trim().length > 0);
  let meta: RunMeta | null = null;
  const rows: RunResultRow[] = [];
  let start = 0;
  if (lines.length > 0) {
    try {
      const first = JSON.parse(lines[0]!) as unknown;
      const parsedMeta = parseMeta(first);
      if (parsedMeta !== null) {
        meta = parsedMeta;
        start = 1;
      }
    } catch {
      // treat as result row below
    }
  }
  for (let i = start; i < lines.length; i++) {
    try {
      const row = parseRow(JSON.parse(lines[i]!) as unknown);
      if (row !== null) rows.push(row);
    } catch {
      // skip invalid lines
    }
  }
  return { meta, rows };
}

export function aggregateModels(rows: readonly RunResultRow[]): readonly ModelStats[] {
  const byModel = new Map<string, RunResultRow[]>();
  for (const row of rows) {
    const list = byModel.get(row.model) ?? [];
    list.push(row);
    byModel.set(row.model, list);
  }
  const models = [...byModel.keys()].sort();
  return models.map((model) => {
    const mine = byModel.get(model) ?? [];
    const scored = mine.filter((r): r is RunResultRow & { score: number } => r.score !== null);
    const passed = scored.filter((r) => r.pass === true).length;
    const meanScore =
      scored.length === 0 ? null : scored.reduce((sum, r) => sum + r.score, 0) / scored.length;
    const failedCalls = mine.filter((r) => r.score === null).length;
    const tested = mine.filter((r) => r.tests_passed !== null);
    const withTests = tested.length > 0;
    return {
      model,
      scored: scored.length,
      passed,
      meanScore,
      failedCalls,
      testsOk: withTests ? tested.filter((r) => r.tests_passed).length : null,
      tested: withTests ? tested.length : null,
    };
  });
}

/** Case ids where scored models disagree on pass/fail (failed calls ignored). */
export function disagreements(rows: readonly RunResultRow[]): readonly string[] {
  const byCase = new Map<string, RunResultRow[]>();
  for (const row of rows) {
    const list = byCase.get(row.case_id) ?? [];
    list.push(row);
    byCase.set(row.case_id, list);
  }
  const lines: string[] = [];
  for (const [caseId, group] of [...byCase.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const scored = group.filter((r) => r.score !== null);
    const passed = scored.filter((r) => r.pass === true).map((r) => r.model);
    if (scored.length < 2 || passed.length === 0 || passed.length === scored.length) continue;
    const failed = scored.filter((r) => r.pass !== true).map((r) => r.model);
    lines.push(`${printable(caseId)}: passed by ${passed.join(', ')}; not by ${failed.join(', ')}`);
  }
  return lines;
}

function deltaFor(current: readonly ModelStats[], baseline: readonly ModelStats[]): readonly ModelDelta[] {
  const base = new Map(baseline.map((s) => [s.model, s]));
  const models = new Set([...current.map((s) => s.model), ...baseline.map((s) => s.model)]);
  return [...models].sort().map((model) => {
    const a = current.find((s) => s.model === model);
    const b = base.get(model);
    return {
      model,
      passedDelta: a === undefined || b === undefined ? null : a.passed - b.passed,
      meanScoreDelta: a?.meanScore == null || b?.meanScore == null ? null : a.meanScore - b.meanScore,
    };
  });
}

export function buildCompareReport(input: {
  readonly current: ParsedRunFile;
  readonly baseline: ParsedRunFile | null;
  readonly ruleNote: string;
}): CompareReport {
  const models = aggregateModels(input.current.rows);
  const withTests = models.some((m) => m.tested !== null);
  const diffs = disagreements(input.current.rows);
  const shown = diffs.slice(0, MAX_COMPARE_DIFFERENCES);
  const more =
    diffs.length > shown.length ? [`… and ${diffs.length - shown.length} more (see the results JSONL)`] : [];
  const baselineModels = input.baseline === null ? null : aggregateModels(input.baseline.rows);
  return {
    label: input.current.meta?.label ?? null,
    baselineLabel: input.baseline?.meta?.label ?? null,
    models,
    deltas: baselineModels === null ? null : deltaFor(models, baselineModels),
    disagreements: [...shown, ...more],
    ruleNote: input.ruleNote,
    withTests,
  };
}

function fmtMean(value: number | null): string {
  return value === null ? 'n/a' : value.toFixed(2);
}

function mdCell(value: string): string {
  return printable(value).replace(/\|/g, '\\|');
}

function fmtDelta(value: number | null, digits = 0): string {
  if (value === null) return 'n/a';
  const sign = value > 0 ? '+' : '';
  return digits === 0 ? `${sign}${value}` : `${sign}${value.toFixed(digits)}`;
}

export function formatCompareMarkdown(report: CompareReport): string {
  const header = report.withTests
    ? ['model', 'scored', 'passed', 'mean', 'failed', 'tests ok', 'tested']
    : ['model', 'scored', 'passed', 'mean', 'failed'];
  const rows = report.models.map((m) => {
    const base = [mdCell(m.model), String(m.scored), String(m.passed), fmtMean(m.meanScore), String(m.failedCalls)];
    return report.withTests ? [...base, String(m.testsOk ?? 0), String(m.tested ?? 0)] : base;
  });
  const lines = [
    '# NightOwl eval A/B compare',
    '',
    report.label === null ? 'Label: (none)' : `Label: ${printable(report.label)}`,
    report.baselineLabel === null
      ? report.deltas === null
        ? 'Baseline: (none)'
        : 'Baseline label: (none)'
      : `Baseline label: ${printable(report.baselineLabel)}`,
    report.ruleNote,
    '',
    '## Models',
    '',
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${r.join(' | ')} |`),
    '',
  ];
  if (report.deltas !== null) {
    lines.push('## Delta vs baseline', '');
    lines.push('| model | passed Δ | mean Δ |');
    lines.push('| --- | --- | --- |');
    for (const d of report.deltas) {
      lines.push(`| ${mdCell(d.model)} | ${fmtDelta(d.passedDelta)} | ${fmtDelta(d.meanScoreDelta, 2)} |`);
    }
    lines.push('');
  }
  lines.push('## Disagreements', '');
  if (report.disagreements.length === 0) {
    lines.push('Same pass/fail for every case the models answered.', '');
  } else {
    for (const d of report.disagreements) lines.push(`- ${d}`);
    lines.push('');
  }
  lines.push('_Local-only. Does not call models. Grades AI, not people._', '');
  return lines.join('\n');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatCompareHtml(report: CompareReport): string {
  const head = report.withTests
    ? ['model', 'scored', 'passed', 'mean', 'failed', 'tests ok', 'tested']
    : ['model', 'scored', 'passed', 'mean', 'failed'];
  const bodyRows = report.models
    .map((m) => {
      const cells = [
        m.model,
        m.scored,
        m.passed,
        fmtMean(m.meanScore),
        m.failedCalls,
        ...(report.withTests ? [m.testsOk ?? 0, m.tested ?? 0] : []),
      ];
      return `<tr>${cells.map((c) => `<td>${escapeHtml(String(c))}</td>`).join('')}</tr>`;
    })
    .join('');
  const deltaSection =
    report.deltas === null
      ? ''
      : `<h2>Delta vs baseline</h2><table><thead><tr><th>model</th><th>passed Δ</th><th>mean Δ</th></tr></thead><tbody>${report.deltas
          .map(
            (d) =>
              `<tr><td>${escapeHtml(d.model)}</td><td>${escapeHtml(fmtDelta(d.passedDelta))}</td><td>${escapeHtml(fmtDelta(d.meanScoreDelta, 2))}</td></tr>`,
          )
          .join('')}</tbody></table>`;
  const diffs =
    report.disagreements.length === 0
      ? '<p>Same pass/fail for every case the models answered.</p>'
      : `<ul>${report.disagreements.map((d) => `<li>${escapeHtml(d)}</li>`).join('')}</ul>`;
  return [
    '<!DOCTYPE html>',
    '<html lang="en"><head><meta charset="utf-8"><title>NightOwl eval A/B</title>',
    '<style>body{font-family:system-ui,sans-serif;max-width:48rem;margin:2rem auto;padding:0 1rem;line-height:1.45}',
    'table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:0.35rem 0.5rem;text-align:left}',
    'th{background:#f4f4f4}</style></head><body>',
    '<h1>NightOwl eval A/B compare</h1>',
    `<p><em>Local-only HTML. Does not call models. Grades AI, not people.</em></p>`,
    `<p>${escapeHtml(report.label === null ? 'Label: (none)' : `Label: ${report.label}`)}</p>`,
    `<p>${escapeHtml(
      report.baselineLabel === null
        ? report.deltas === null
          ? 'Baseline: (none)'
          : 'Baseline label: (none)'
        : `Baseline label: ${report.baselineLabel}`,
    )}</p>`,
    `<p>${escapeHtml(report.ruleNote)}</p>`,
    '<h2>Models</h2>',
    `<table><thead><tr>${head.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${bodyRows}</tbody></table>`,
    deltaSection,
    '<h2>Disagreements</h2>',
    diffs,
    '</body></html>',
    '',
  ].join('\n');
}

export function formatRunMetaLine(meta: Omit<RunMeta, 'schema'>): string {
  return JSON.stringify({
    schema: RUN_META_SCHEMA,
    label: meta.label,
    models: meta.models,
    run_at: meta.run_at,
  });
}

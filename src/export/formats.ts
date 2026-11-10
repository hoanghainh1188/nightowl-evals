export const EXPORT_FORMATS = Object.freeze(['jsonl', 'swe-bench', 'promptfoo'] as const);
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const SWE_BENCH_SCHEMA = 'nightowl.swe-bench/v1';
export const PROMPTFOO_MARKER = '# nightowl.promptfoo/v1';

export const DEFAULT_FILES: Readonly<Record<ExportFormat, string>> = Object.freeze({
  jsonl: 'evals.jsonl',
  'swe-bench': 'swe-bench.jsonl',
  promptfoo: 'promptfooconfig.yaml',
});

export function isExportFormat(value: string): value is ExportFormat {
  return (EXPORT_FORMATS as readonly string[]).includes(value);
}

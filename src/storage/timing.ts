/** Soft budget for a sample report-read query in doctor (warn only). */
export const REPORT_QUERY_BUDGET_MS = 500;

/** Lookback window used when doctor samples report query latency. */
export const DOCTOR_REPORT_SAMPLE_DAYS = 30;

export interface Timed<T> {
  readonly result: T;
  readonly ms: number;
}

/** Wall-clock measure for local diagnostics (no network). */
export function measureSync<T>(fn: () => T): Timed<T> {
  const start = performance.now();
  const result = fn();
  return { result, ms: performance.now() - start };
}

export function formatReportTimingLine(parts: Readonly<Record<string, number>>): string {
  const body = Object.entries(parts)
    .map(([name, ms]) => `${name}=${Math.round(ms)}ms`)
    .join(' ');
  return `nightowl report: timing: ${body}\n`;
}

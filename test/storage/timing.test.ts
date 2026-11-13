import { describe, expect, it } from 'vitest';
import { formatReportTimingLine, measureSync, REPORT_QUERY_BUDGET_MS } from '../../src/storage/timing.js';

describe('storage timing helpers', () => {
  it('exposes the doctor report-query budget', () => {
    expect(REPORT_QUERY_BUDGET_MS).toBe(500);
  });

  it('measures sync work and formats report timing lines', () => {
    const timed = measureSync(() => 42);
    expect(timed.result).toBe(42);
    expect(timed.ms).toBeGreaterThanOrEqual(0);
    expect(formatReportTimingLine({ failures: 1.2, checks: 3.8, total: 10 })).toBe(
      'nightowl report: timing: failures=1ms checks=4ms total=10ms\n',
    );
  });
});

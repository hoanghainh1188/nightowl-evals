import { describe, expect, it } from 'vitest';
import { buildReport } from '../../src/report/build.js';
import { formatJson } from '../../src/report/format.js';

describe('report by agent', () => {
  it('aggregates by_agent and head_to_head', () => {
    const report = buildReport({
      depth: 2,
      since: null,
      generatedAt: '2026-11-09T00:00:00.000Z',
      failures: [
        { filePath: 'a.ts', category: 'logic', status: 'flagged', source: 'manual-fix', agent: 'cursor', day: '2026-11-09', count: 3 },
        { filePath: 'b.ts', category: 'logic', status: 'flagged', source: 'manual-fix', agent: 'claude-code', day: '2026-11-09', count: 1 },
      ],
      checks: [
        { day: '2026-11-09', outcome: 'failure', agent: 'cursor', count: 3 },
        { day: '2026-11-09', outcome: 'not-a-failure', agent: 'cursor', count: 9 },
        { day: '2026-11-09', outcome: 'failure', agent: 'claude-code', count: 1 },
        { day: '2026-11-09', outcome: 'not-a-failure', agent: 'claude-code', count: 9 },
      ],
    });
    expect(report.byAgent).toEqual({ 'claude-code': 1, cursor: 3 });
    expect(report.headToHead).toEqual([
      { agent: 'claude-code', failures: 1, checked: 10, rate: 0.1 },
      { agent: 'cursor', failures: 3, checked: 12, rate: 0.25 },
    ]);
    const json = JSON.parse(formatJson(report));
    expect(json.by_agent).toEqual(report.byAgent);
    expect(json.head_to_head).toEqual(report.headToHead);
  });
});

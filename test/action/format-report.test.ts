import { execFile } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const SCRIPT = join(import.meta.dirname, '../../action/scripts/format-report.mjs');
const STICKY_MARKER = '<!-- nightowl-evals-report -->';

const sampleReport = {
  generated_at: '2026-11-10T12:00:00.000Z',
  since: '2026-01-01T00:00:00.000Z',
  depth: 2,
  total: 5,
  unclassified: 1,
  dismissed: 2,
  changed_rate: { failures: 2, checked: 5, rate: 0.4 },
  by_category: { logic: 3, convention: 2, 'misread-requirement': 0, 'missing-context': 0 },
  by_module: [
    { module: 'src/cli', failures: 3 },
    { module: 'src/hooks', failures: 2 },
  ],
};

async function formatViaCli(report: unknown): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'nightowl-action-'));
  const reportPath = join(dir, 'report.json');
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const { stdout } = await execFileAsync(process.execPath, [SCRIPT, reportPath], { encoding: 'utf8' });
  return stdout;
}

describe('format-report.mjs', () => {
  it('includes sticky marker, totals, rate, and top lists', async () => {
    const md = await formatViaCli(sampleReport);
    expect(md).toContain(STICKY_MARKER);
    expect(md).toContain('## AI Coding Health Report');
    expect(md).toContain('| Total failures | 5 |');
    expect(md).toContain('40% (2 of 5 checked)');
    expect(md).toContain('_Window since 2026-01-01_');
    expect(md).toContain('- **logic**: 3');
    expect(md).toContain('- **src/cli**: 3');
  });

  it('shows n/a when nothing was checked', async () => {
    const md = await formatViaCli({
      ...sampleReport,
      total: 0,
      changed_rate: { failures: 0, checked: 0, rate: null },
      by_category: {},
      by_module: [],
      since: null,
    });
    expect(md).toContain('n/a (0 of 0 checked)');
    expect(md).toContain('_All recorded history_');
    expect(md).toContain('_None_');
  });
});

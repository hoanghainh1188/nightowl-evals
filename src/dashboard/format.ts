import { printable } from '../shared/printable.js';
import type { Rate, Report } from '../report/build.js';
import { RECENT_WEEKS, TOP_CLUSTERS, TOP_MODULES } from '../report/format.js';

function percent(rate: number | null): string {
  return rate === null ? 'n/a' : `${Math.round(rate * 100)}%`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function rateLine(rate: Rate): string {
  if (rate.checked === 0 || rate.rate === null) {
    return 'Changed rate: n/a (no checks in window)';
  }
  return `Changed rate: ${percent(rate.rate)} (${rate.failures}/${rate.checked} AI edits changed at commit)`;
}

function isEmpty(report: Report): boolean {
  return report.total === 0 && report.changedRate.checked === 0;
}

function tableRows(entries: ReadonlyArray<readonly [string, string]>): string {
  return entries
    .map(([k, v]) => `<tr><td>${escapeHtml(printable(k))}</td><td>${escapeHtml(v)}</td></tr>`)
    .join('\n');
}

function addTable(parts: string[], title: string, rows: ReadonlyArray<readonly [string, string]>): void {
  parts.push(`<h2>${escapeHtml(title)}</h2>`);
  parts.push('<table><tbody>');
  parts.push(tableRows(rows));
  parts.push('</tbody></table>');
}

export function formatDashboardHtml(report: Report): string {
  const parts: string[] = [
    '<h1>NightOwl local dashboard</h1>',
    '<p><em>Local-only HTML from this machine. Not a SaaS team dashboard. Grades AI, not people.</em></p>',
  ];

  if (isEmpty(report)) {
    parts.push('<p>Not enough data yet to build a dashboard. Keep coding with hooks enabled, then re-run.</p>');
  } else {
    parts.push('<h2>Summary</h2>');
    parts.push('<ul>');
    parts.push(`<li><strong>Total failures</strong>: ${report.total}</li>`);
    parts.push(`<li><strong>Unclassified</strong>: ${report.unclassified}</li>`);
    parts.push(`<li><strong>Dismissed (not counted)</strong>: ${report.dismissed}</li>`);
    parts.push(`<li><strong>${escapeHtml(rateLine(report.changedRate))}</strong></li>`);
    parts.push(
      `<li><strong>Signals</strong>: ci-fail ${report.signals.ciFail}, pr-review ${report.signals.prReview}</li>`,
    );
    const noiseRate =
      report.noise.reviewRate === null ? 'n/a' : `${Math.round(report.noise.reviewRate * 100)}%`;
    parts.push(
      `<li><strong>Noise estimate</strong>: review-dismissed ${escapeHtml(noiseRate)} (${report.noise.sample.dismissed}/${report.noise.sample.confirmed + report.noise.sample.dismissed} reviewed), auto-noise ${report.noise.autoNoise}</li>`,
    );
    if (report.since !== null) {
      parts.push(`<li><strong>Since</strong>: ${escapeHtml(report.since.slice(0, 10))}</li>`);
    }
    if (report.agents !== null) {
      parts.push(`<li><strong>Agents</strong>: ${escapeHtml(report.agents.join(', '))}</li>`);
    }
    parts.push('</ul>');

    addTable(
      parts,
      'By category',
      Object.entries(report.byCategory).map(([k, n]) => [k, String(n)] as const),
    );
    addTable(parts, 'By status', Object.entries(report.byStatus).map(([k, n]) => [k, String(n)] as const));
    addTable(parts, 'By agent', Object.entries(report.byAgent).map(([k, n]) => [k, String(n)] as const));
    addTable(
      parts,
      'Head-to-head',
      report.headToHead.map(
        (h) => [h.agent, `${h.failures}/${h.checked} checked (${percent(h.rate)})`] as const,
      ),
    );

    const modules = report.byModule.slice(0, TOP_MODULES);
    addTable(
      parts,
      `By module (top ${modules.length}/${report.byModule.length}, depth ${report.depth})`,
      modules.map((m) => [m.module, String(m.failures)] as const),
    );

    const weeks = report.byWeek.slice(-RECENT_WEEKS);
    addTable(
      parts,
      'By week (recent)',
      weeks.map((w) => [w.week, `${w.recorded} recorded · ${percent(w.rate)}`] as const),
    );

    const tableNoiseRate =
      report.noise.reviewRate === null ? 'n/a (not enough review data)' : `${Math.round(report.noise.reviewRate * 100)}%`;
    addTable(parts, 'Noise estimate', [
      ['Review dismissed rate', tableNoiseRate],
      ['Auto-noise failures', String(report.noise.autoNoise)],
      ['Confirmed sample', String(report.noise.sample.confirmed)],
      ['Dismissed sample', String(report.noise.sample.dismissed)],
    ]);

    const clusters = report.clusters.slice(0, TOP_CLUSTERS);
    if (clusters.length === 0) {
      parts.push('<h2>Top clusters</h2>');
      parts.push('<p>No clusters with 2+ failures yet.</p>');
    } else {
      addTable(
        parts,
        `Top clusters (${clusters.length})`,
        clusters.map(
          (c) =>
            [
              `${c.category} · ${c.module}${c.agent ? ` · ${c.agent}` : ''} · ${c.fingerprint.slice(0, 8)}`,
              String(c.count),
            ] as const,
        ),
      );
    }
  }

  parts.push(`<p><small>Generated at: ${escapeHtml(report.generatedAt)}</small></p>`);

  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>NightOwl local dashboard</title>',
    '<style>',
    'body{font-family:system-ui,sans-serif;margin:1.5rem;line-height:1.45;color:#111;background:#fafafa}',
    'h1,h2{color:#0f172a}',
    'table{border-collapse:collapse;margin:.5rem 0 1.25rem;background:#fff}',
    'td{border:1px solid #ccc;padding:.35rem .6rem}',
    'td:first-child{font-weight:600}',
    'ul{padding-left:1.2rem}',
    '</style>',
    '</head>',
    '<body>',
    parts.join('\n'),
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

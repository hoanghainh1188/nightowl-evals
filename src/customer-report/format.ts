import { printable } from '../shared/printable.js';
import type { Rate, Report } from '../report/build.js';
import { TOP_MODULES, RECENT_WEEKS } from '../report/format.js';
import { LABELS, type CustomerLabels, type CustomerLang } from './templates.js';

export type CustomerLangOption = CustomerLang | 'both';
export type CustomerFormat = 'md' | 'html';

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

function rateLine(labels: CustomerLabels, rate: Rate): string {
  if (rate.checked === 0 || rate.rate === null) {
    return `${labels.changedRate}: ${labels.noRateData}`;
  }
  return `${labels.changedRate}: ${percent(rate.rate)} (${rate.failures}/${rate.checked} ${labels.changedRateDetail})`;
}

function isEmpty(report: Report): boolean {
  return report.total === 0 && report.changedRate.checked === 0;
}

function safeMdLabel(text: string): string {
  // Neutralize HTML-ish chars for Markdown viewers that pass through raw HTML.
  return escapeHtml(printable(text));
}

function bulletMap(entries: ReadonlyArray<readonly [string, string]>): string[] {
  return entries.map(([k, v]) => `- **${safeMdLabel(k)}**: ${v}`);
}

function sectionMarkdown(report: Report, lang: CustomerLang): string {
  const labels = LABELS[lang];
  const lines: string[] = [`# ${labels.title}`, '', `> ${labels.privacyNote}`, ''];

  if (isEmpty(report)) {
    lines.push(labels.empty, '');
    lines.push(`_${labels.generatedAt}: ${report.generatedAt}_`);
    if (report.since !== null) lines.push(`_${labels.since}: ${report.since.slice(0, 10)}_`);
    lines.push('');
    return lines.join('\n');
  }

  lines.push(`## ${labels.summary}`, '');
  lines.push(`- **${labels.totalFailures}**: ${report.total}`);
  lines.push(`- **${labels.unclassified}**: ${report.unclassified}`);
  lines.push(`- **${labels.dismissedNotCounted}**: ${report.dismissed}`);
  lines.push(`- **${rateLine(labels, report.changedRate)}**`);
  if (report.since !== null) lines.push(`- **${labels.since}**: ${report.since.slice(0, 10)}`);
  lines.push('');

  lines.push(`## ${labels.byCategory}`, '');
  lines.push(...bulletMap(Object.entries(report.byCategory).map(([k, n]) => [k, String(n)] as const)), '');

  lines.push(`## ${labels.byAgent}`, '');
  lines.push(...bulletMap(Object.entries(report.byAgent).map(([k, n]) => [k, String(n)] as const)), '');

  lines.push(`## ${labels.headToHead}`, '');
  lines.push(
    ...bulletMap(
      report.headToHead.map(
        (h) => [h.agent, `${h.failures}/${h.checked} ${labels.checked} (${percent(h.rate)})`] as const,
      ),
    ),
    '',
  );

  const modules = report.byModule.slice(0, TOP_MODULES);
  lines.push(`## ${labels.byModule} (top ${modules.length}/${report.byModule.length}, depth ${report.depth})`, '');
  lines.push(...bulletMap(modules.map((m) => [m.module, String(m.failures)] as const)), '');

  const weeks = report.byWeek.slice(-RECENT_WEEKS);
  lines.push(`## ${labels.byWeek} (${labels.weekNote})`, '');
  lines.push(
    ...bulletMap(weeks.map((w) => [w.week, `${w.recorded} · ${percent(w.rate)}`] as const)),
    '',
  );

  lines.push(`_${labels.generatedAt}: ${report.generatedAt}_`, '');
  return lines.join('\n');
}

export function formatCustomerMarkdown(report: Report, lang: CustomerLangOption): string {
  if (lang === 'both') {
    return `${sectionMarkdown(report, 'vi')}\n---\n\n${sectionMarkdown(report, 'ja')}`;
  }
  return sectionMarkdown(report, lang);
}

function tableRowsHtml(entries: ReadonlyArray<readonly [string, string]>): string {
  return entries
    .map(([k, v]) => `<tr><td>${escapeHtml(printable(k))}</td><td>${escapeHtml(v)}</td></tr>`)
    .join('\n');
}

function sectionHtml(report: Report, lang: CustomerLang): string {
  const labels = LABELS[lang];
  const parts: string[] = [
    `<section lang="${lang}">`,
    `<h1>${escapeHtml(labels.title)}</h1>`,
    `<p><em>${escapeHtml(labels.privacyNote)}</em></p>`,
  ];

  if (isEmpty(report)) {
    parts.push(`<p>${escapeHtml(labels.empty)}</p>`);
    parts.push(`<p><small>${escapeHtml(labels.generatedAt)}: ${escapeHtml(report.generatedAt)}</small></p>`);
    if (report.since !== null) {
      parts.push(`<p><small>${escapeHtml(labels.since)}: ${escapeHtml(report.since.slice(0, 10))}</small></p>`);
    }
    parts.push('</section>');
    return parts.join('\n');
  }

  parts.push(`<h2>${escapeHtml(labels.summary)}</h2>`);
  parts.push('<ul>');
  parts.push(`<li><strong>${escapeHtml(labels.totalFailures)}</strong>: ${report.total}</li>`);
  parts.push(`<li><strong>${escapeHtml(labels.unclassified)}</strong>: ${report.unclassified}</li>`);
  parts.push(`<li><strong>${escapeHtml(labels.dismissedNotCounted)}</strong>: ${report.dismissed}</li>`);
  parts.push(`<li><strong>${escapeHtml(rateLine(labels, report.changedRate))}</strong></li>`);
  if (report.since !== null) {
    parts.push(`<li><strong>${escapeHtml(labels.since)}</strong>: ${escapeHtml(report.since.slice(0, 10))}</li>`);
  }
  parts.push('</ul>');

  const addTable = (title: string, rows: ReadonlyArray<readonly [string, string]>) => {
    parts.push(`<h2>${escapeHtml(title)}</h2>`);
    parts.push('<table><tbody>');
    parts.push(tableRowsHtml(rows));
    parts.push('</tbody></table>');
  };

  addTable(labels.byCategory, Object.entries(report.byCategory).map(([k, n]) => [k, String(n)] as const));
  addTable(labels.byAgent, Object.entries(report.byAgent).map(([k, n]) => [k, String(n)] as const));
  addTable(
    labels.headToHead,
    report.headToHead.map((h) => [h.agent, `${h.failures}/${h.checked} ${labels.checked} (${percent(h.rate)})`] as const),
  );

  const modules = report.byModule.slice(0, TOP_MODULES);
  addTable(
    `${labels.byModule} (top ${modules.length}/${report.byModule.length}, depth ${report.depth})`,
    modules.map((m) => [m.module, String(m.failures)] as const),
  );

  const weeks = report.byWeek.slice(-RECENT_WEEKS);
  addTable(
    `${labels.byWeek} (${labels.weekNote})`,
    weeks.map((w) => [w.week, `${w.recorded} · ${percent(w.rate)}`] as const),
  );

  parts.push(`<p><small>${escapeHtml(labels.generatedAt)}: ${escapeHtml(report.generatedAt)}</small></p>`);
  parts.push('</section>');
  return parts.join('\n');
}

export function formatCustomerHtml(report: Report, lang: CustomerLangOption): string {
  const body =
    lang === 'both'
      ? `${sectionHtml(report, 'vi')}\n<hr>\n${sectionHtml(report, 'ja')}`
      : sectionHtml(report, lang);
  const htmlLang = lang === 'both' ? 'vi' : lang;
  return [
    '<!DOCTYPE html>',
    `<html lang="${htmlLang}">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>NightOwl customer quality report</title>',
    '<style>',
    'body{font-family:system-ui,sans-serif;margin:1.5rem;line-height:1.45;color:#111}',
    'table{border-collapse:collapse;margin:.5rem 0 1.25rem}',
    'td{border:1px solid #ccc;padding:.35rem .6rem}',
    'td:first-child{font-weight:600}',
    'hr{margin:2rem 0;border:none;border-top:1px solid #ddd}',
    '</style>',
    '</head>',
    '<body>',
    body,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

export function formatCustomerReport(
  report: Report,
  options: { readonly lang: CustomerLangOption; readonly format: CustomerFormat },
): string {
  return options.format === 'html'
    ? formatCustomerHtml(report, options.lang)
    : formatCustomerMarkdown(report, options.lang);
}

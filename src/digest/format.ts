import { formatRuleImpactLine } from '../impact/summary.js';
import { printable } from '../shared/printable.js';
import type { Digest } from './build.js';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function listMd(title: string, rows: Digest['topCategories']): string[] {
  if (rows.length === 0) return [`### ${title}`, '- (none)'];
  return [`### ${title}`, ...rows.map((r) => `- ${printable(r.name)}: ${r.count}`)];
}

export function formatDigestMarkdown(digest: Digest): string {
  const since = digest.since.slice(0, 10);
  const lines = [
    `# NightOwl digest since ${since}`,
    '',
    `New failures (not dismissed): **${digest.total}**`,
    `Open for review (flagged): **${digest.flagged}**`,
    `Signals: ci-fail ${digest.signals.ciFail}, pr-review ${digest.signals.prReview}, revert ${digest.signals.revert}`,
    formatRuleImpactLine(digest.ruleImpact),
    '',
    ...listMd('Top categories', digest.topCategories),
    '',
    ...listMd('Top agents', digest.topAgents),
    '',
    '_Local-only. Does not email/Slack. Grades AI, not people._',
    '',
  ];
  return lines.join('\n');
}

export function formatDigestHtml(digest: Digest): string {
  const since = escapeHtml(digest.since.slice(0, 10));
  const rows = (items: Digest['topCategories']) =>
    items.length === 0
      ? '<li>(none)</li>'
      : items.map((r) => `<li>${escapeHtml(printable(r.name))}: ${r.count}</li>`).join('\n');
  const body = [
    '<!DOCTYPE html>',
    '<html lang="en"><head><meta charset="utf-8"><title>NightOwl digest</title>',
    '<style>body{font-family:system-ui,sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem;line-height:1.45}',
    'h1{font-size:1.4rem} ul{padding-left:1.2rem}</style></head><body>',
    `<h1>NightOwl digest since ${since}</h1>`,
    `<p><em>Local-only HTML. Does not email/Slack. Grades AI, not people.</em></p>`,
    `<ul>`,
    `<li><strong>New failures (not dismissed)</strong>: ${digest.total}</li>`,
    `<li><strong>Open for review (flagged)</strong>: ${digest.flagged}</li>`,
    `<li><strong>Signals</strong>: ci-fail ${digest.signals.ciFail}, pr-review ${digest.signals.prReview}, revert ${digest.signals.revert}</li>`,
    `<li>${escapeHtml(formatRuleImpactLine(digest.ruleImpact))}</li>`,
    `</ul>`,
    `<h2>Top categories</h2><ul>${rows(digest.topCategories)}</ul>`,
    `<h2>Top agents</h2><ul>${rows(digest.topAgents)}</ul>`,
    '</body></html>',
    '',
  ];
  return body.join('\n');
}

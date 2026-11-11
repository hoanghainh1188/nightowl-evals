import { printable } from '../shared/printable.js';
import type { Rate, Report } from './build.js';

export const TOP_MODULES = 10;
export const RECENT_WEEKS = 8;
const BAR_WIDTH = 30;
const LABEL_WIDTH = 22;

function percent(rate: number | null): string {
  return rate === null ? 'n/a' : `${Math.round(rate * 100)}%`;
}

function bar(n: number, max: number): string {
  return n === 0 || max === 0 ? '' : '█'.repeat(Math.max(1, Math.round((n / max) * BAR_WIDTH)));
}

function rows(entries: ReadonlyArray<readonly [string, number, string?]>): string[] {
  const max = Math.max(0, ...entries.map(([, n]) => n));
  const countWidth = Math.max(1, ...entries.map(([, n]) => String(n).length));
  return entries.map(([label, n, extra]) => {
    const line = `  ${printable(label).padEnd(LABEL_WIDTH)} ${String(n).padStart(countWidth)}  ${bar(n, max).padEnd(extra ? BAR_WIDTH : 0)}`;
    return (extra ? `${line} ${extra}` : line).trimEnd();
  });
}

function changedLine(rate: Rate): string {
  return `AI edits changed by the developer: ${rate.failures} of ${rate.checked} checked at commit (${percent(rate.rate)})`;
}

function reviewedLine(byStatus: Readonly<Record<string, number>>): string {
  const n = (status: string) => byStatus[status] ?? 0;
  return `Reviewed: ${n('confirmed')} confirmed, ${n('dismissed')} dismissed, ${n('flagged')} still flagged (nightowl review)`;
}

export function formatText(report: Report): string {
  const since = report.since === null ? '' : ` since ${report.since.slice(0, 10)}`;
  const plural = report.total === 1 ? 'failure' : 'failures';
  const header = `NightOwl report${since}: ${report.total} ${plural} (${report.unclassified} unclassified, ${report.dismissed} dismissed not counted)`;
  const signalsLine = `Signals (events, not failures): ci-fail ${report.signals.ciFail}, pr-review ${report.signals.prReview}`;
  const noiseRate =
    report.noise.reviewRate === null ? 'n/a' : `${Math.round(report.noise.reviewRate * 100)}%`;
  const noiseLine = `Noise estimate: review-dismissed ${noiseRate} (${report.noise.sample.dismissed}/${report.noise.sample.confirmed + report.noise.sample.dismissed} reviewed), auto-noise ${report.noise.autoNoise}`;
  if (report.total === 0 && report.changedRate.checked === 0) {
    return `${header}\n${signalsLine}\n${noiseLine}\nNo failures recorded yet. Commit some code Claude Code wrote, then run this again.\n`;
  }

  const modules = report.byModule.slice(0, TOP_MODULES);
  const weeks = report.byWeek.slice(-RECENT_WEEKS);
  return [
    header,
    changedLine(report.changedRate),
    reviewedLine(report.byStatus),
    signalsLine,
    noiseLine,
    '',
    'By category',
    ...rows(Object.entries(report.byCategory)),
    '',
    'By source',
    ...rows(Object.entries(report.bySource)),
    '',
    'By agent',
    ...rows(Object.entries(report.byAgent)),
    '',
    'Head-to-head (edits changed / checked)',
    ...rows(report.headToHead.map((h) => [h.agent, h.failures, `${h.checked} checked (${percent(h.rate)})`] as const)),
    '',
    `By module (top ${modules.length} of ${report.byModule.length}, depth ${report.depth})`,
    ...rows(modules.map((m) => [m.module, m.failures] as const)),
    '',
    `By week (last ${weeks.length}, UTC; % = AI edits changed)`,
    ...rows(weeks.map((w) => [w.week, w.recorded, percent(w.rate)] as const)),
    '',
  ].join('\n');
}

export function formatJson(report: Report): string {
  return `${JSON.stringify(
    {
      generated_at: report.generatedAt,
      since: report.since,
      depth: report.depth,
      total: report.total,
      unclassified: report.unclassified,
      dismissed: report.dismissed,
      changed_rate: report.changedRate,
      by_category: report.byCategory,
      by_source: report.bySource,
      by_status: report.byStatus,
      by_agent: report.byAgent,
      head_to_head: report.headToHead,
      agents: report.agents,
      by_module: report.byModule,
      by_week: report.byWeek.map((w) => ({ week: w.week, failures: w.recorded, checked: w.checked, changed: w.failures, rate: w.rate })),
      signals: { ci_fail: report.signals.ciFail, pr_review: report.signals.prReview },
      noise: {
        review_rate: report.noise.reviewRate,
        auto_noise: report.noise.autoNoise,
        sample: report.noise.sample,
      },
    },
    null,
    2,
  )}\n`;
}

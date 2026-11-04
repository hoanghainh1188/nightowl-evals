import { unifiedDiff } from '../classify/diff.js';
import { compareContent } from '../hooks/git/compare.js';
import type { FailureForReview } from '../storage/review-queries.js';

export const MAX_DIFF_LINES = 200;
export const MAX_DIFF_LINE_CHARS = 300;
const PROMPT_CHARS = 40;

// Text from the repository or the database never drives the terminal: every control character
// but tab and newline is replaced, and so are characters that reverse or hide text.
// Carriage returns are dropped.
export function terminalSafe(text: string): string {
  return (
    text
      .replace(/\r/g, '')
      // biome-ignore lint: control characters are the point here.
      .replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '?')
  );
}

const oneLine = (text: string): string => terminalSafe(text).replace(/\s+/g, ' ').trim();

function promptSnippet(prompt: string | null): string {
  if (prompt === null) return '(no prompt)';
  const first = oneLine(prompt.split('\n').find((line) => line.trim() !== '') ?? '');
  const chars = [...first];
  return `"${chars.length > PROMPT_CHARS ? `${chars.slice(0, PROMPT_CHARS).join('')}…` : first}"`;
}

function counts(failure: FailureForReview): string {
  const { lines_added: added, lines_removed: removed } = compareContent(failure.aiContent, failure.finalContent);
  return `+${added} -${removed}`;
}

// `label` is the status listed, or null when every status is.
export function formatList(failures: readonly FailureForReview[], label: string | null): string {
  if (failures.length === 0) return label === null ? 'No failures match.\n' : `No ${label} failures. Try: nightowl review --status all\n`;
  const lines = failures.map((f) =>
    [
      `#${f.id}`.padEnd(5),
      oneLine(f.createdAt.slice(0, 10)),
      oneLine(f.source).padEnd(11),
      oneLine(f.category ?? 'unclassified').padEnd(19),
      oneLine(f.filePath),
      counts(f),
      promptSnippet(f.prompt),
    ].join('  '),
  );
  return `${lines.join('\n')}\n${failures.length} ${label ?? 'matching'} shown. Details: nightowl review show <id>\n`;
}

const indent = (text: string): string =>
  terminalSafe(text)
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');

function categoryLine(f: FailureForReview): string {
  if (f.category === null) return 'unclassified';
  const confidence = typeof f.categoryConfidence === 'number' ? ` (${f.categoryConfidence.toFixed(2)})` : '';
  const reason = f.categoryReason === null ? '' : `: ${oneLine(f.categoryReason)}`;
  return `${oneLine(f.category)}${confidence}${reason}`;
}

// A line-ending-only change stays visible, and one huge line cannot flood the terminal.
function diffLine(line: string): string {
  const chars = [...terminalSafe(line.replace(/\r/g, '␍'))];
  return chars.length > MAX_DIFF_LINE_CHARS ? `${chars.slice(0, MAX_DIFF_LINE_CHARS).join('')}…` : chars.join('');
}

function diffBlock(f: FailureForReview): string {
  const diff = unifiedDiff(f.aiContent, f.finalContent);
  if (diff === null) {
    const { lines_added: added, lines_removed: removed } = compareContent(f.aiContent, f.finalContent);
    return `  (the versions differ too much to diff: ${added} lines added, ${removed} removed)`;
  }
  // The `--- ai` / `+++ dev` header says nothing the title does not.
  const lines = diff.split('\n').slice(2).filter((line, i, all) => line !== '' || i < all.length - 1);
  if (lines.length === 0) return '  (no difference)';
  const shown = lines.slice(0, MAX_DIFF_LINES).map((line) => `  ${diffLine(line)}`);
  const more = lines.length - MAX_DIFF_LINES;
  return more > 0 ? `${shown.join('\n')}\n  … ${more} more lines` : shown.join('\n');
}

export function formatDetail(f: FailureForReview): string {
  const when = oneLine(`${f.createdAt.slice(0, 10)} ${f.createdAt.slice(11, 16)} UTC`);
  return [
    `#${f.id}  ${oneLine(f.source)}  ${oneLine(f.status)}`,
    `File      ${oneLine(f.filePath)}`,
    `Commit    ${f.commitSha === null ? '(none)' : oneLine(f.commitSha.slice(0, 12))}  ${when}`,
    `Category  ${categoryLine(f)}`,
    '',
    'Prompt',
    f.prompt === null ? '  (not recorded)' : indent(f.prompt),
    ...(f.feedback === null ? [] : ['Feedback', indent(f.feedback)]),
    '',
    'Diff (AI version → final)',
    diffBlock(f),
    '',
    `Mark it: nightowl review confirm ${f.id}  |  nightowl review dismiss ${f.id}`,
    '',
  ].join('\n');
}

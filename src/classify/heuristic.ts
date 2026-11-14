import type { Category } from './prompt.js';
import { unifiedDiff } from './diff.js';

export interface HeuristicInput {
  readonly filePath: string;
  readonly aiContent: string;
  readonly finalContent: string;
  readonly userPrompt?: string | null;
  readonly feedback?: string | null;
}

export interface HeuristicMatch {
  readonly category: Category;
  readonly reason: string;
  readonly confidence: number;
  readonly ruleId: string;
}

const IDENT = /[A-Za-z_][A-Za-z0-9_]*/g;
const IMPORT_LINE =
  /^\s*(?:import\b|export\s+.*?from\b|const\s+\w+\s*=\s*require\s*\(|.*\bfrom\s+['"]).*$/;

function stripWs(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\s+/g, '');
}

function changedLines(diff: string): { removed: string[]; added: string[] } {
  const removed: string[] = [];
  const added: string[] = [];
  for (const line of diff.split('\n')) {
    if (line.startsWith('--- ') || line.startsWith('+++ ') || line.startsWith('@@')) continue;
    if (line.startsWith('-') && !line.startsWith('---')) removed.push(line.slice(1));
    else if (line.startsWith('+') && !line.startsWith('+++')) added.push(line.slice(1));
  }
  return { removed, added };
}

function tokens(text: string): Set<string> {
  return new Set(text.toLowerCase().match(IDENT) ?? []);
}

function overlapRatio(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let hit = 0;
  for (const t of a) if (b.has(t)) hit += 1;
  return hit / Math.max(a.size, b.size);
}

function isWhitespaceOnly(ai: string, final: string): boolean {
  return ai !== final && stripWs(ai) === stripWs(final);
}

function isImportOrPathOnly(diff: string): boolean {
  const { removed, added } = changedLines(diff);
  if (removed.length === 0 && added.length === 0) return false;
  const lines = [...removed, ...added];
  return lines.every((line) => IMPORT_LINE.test(line));
}

function isRenameIdentifier(diff: string): boolean {
  const { removed, added } = changedLines(diff);
  if (removed.length === 0 || added.length === 0) return false;
  if (removed.length !== added.length) return false;
  for (let i = 0; i < removed.length; i++) {
    const before = removed[i];
    const after = added[i];
    if (before === undefined || after === undefined) return false;
    const bt = before.match(IDENT) ?? [];
    const at = after.match(IDENT) ?? [];
    if (bt.length === 0 || at.length === 0) return false;
    // Same shape except one identifier token differs.
    const bRest = before.replace(IDENT, '#');
    const aRest = after.replace(IDENT, '#');
    if (bRest !== aRest) return false;
    let diffs = 0;
    const n = Math.min(bt.length, at.length);
    if (bt.length !== at.length) return false;
    for (let j = 0; j < n; j++) if (bt[j] !== at[j]) diffs += 1;
    if (diffs !== 1) return false;
  }
  return true;
}

function isPromptMismatch(input: HeuristicInput): boolean {
  const prompt = (input.userPrompt ?? '').trim();
  if (prompt === '') return false;
  const promptTok = tokens(prompt);
  const ai = overlapRatio(promptTok, tokens(input.aiContent));
  const final = overlapRatio(promptTok, tokens(input.finalContent));
  // Final clearly closer to the ask than the AI draft.
  return final >= 0.2 && final - ai >= 0.15;
}

/** Deterministic offline classifier. Returns null when no rule is confident enough. */
export function classifyHeuristic(input: HeuristicInput): HeuristicMatch | null {
  if (input.aiContent === input.finalContent) return null;

  if (isWhitespaceOnly(input.aiContent, input.finalContent)) {
    return Object.freeze({
      category: 'convention',
      ruleId: 'whitespace-only',
      confidence: 0.9,
      reason: 'Only whitespace or line-ending changes between AI and final content',
    });
  }

  const diff = unifiedDiff(input.aiContent, input.finalContent);
  if (diff === null) return null;
  if (diff === '') return null;

  if (isImportOrPathOnly(diff)) {
    return Object.freeze({
      category: 'missing-context',
      ruleId: 'import-or-path-only',
      confidence: 0.75,
      reason: 'Change limited to import/require/from path lines',
    });
  }

  if (isRenameIdentifier(diff)) {
    return Object.freeze({
      category: 'convention',
      ruleId: 'rename-identifier',
      confidence: 0.7,
      reason: 'Identifier rename with surrounding code shape unchanged',
    });
  }

  if (isPromptMismatch(input)) {
    return Object.freeze({
      category: 'misread-requirement',
      ruleId: 'prompt-mismatch-hint',
      confidence: 0.65,
      reason: 'Final content overlaps the developer prompt more than the AI draft',
    });
  }

  return null;
}

export function heuristicClassifierLabel(ruleId: string): string {
  return `heuristic:${ruleId}`;
}

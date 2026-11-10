import type { SuggestedRule } from './types.js';
import { RULES_MARKER, RULES_MARKER_END, RULES_MARKER_START } from './types.js';

function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) return 0;
  let count = 0;
  let from = 0;
  while (from < haystack.length) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) break;
    count += 1;
    from = at + needle.length;
  }
  return count;
}

/** True if content has a complete start/end pair or a legacy single marker. */
export function hasRulesMarker(content: string): boolean {
  return hasCompleteRulesBlock(content) || content.includes(RULES_MARKER);
}

export function hasCompleteRulesBlock(content: string): boolean {
  const starts = countOccurrences(content, RULES_MARKER_START);
  const ends = countOccurrences(content, RULES_MARKER_END);
  if (starts !== 1 || ends !== 1) return false;
  return content.indexOf(RULES_MARKER_START) < content.indexOf(RULES_MARKER_END);
}

/** Wrap inner Markdown (without outer markers) in a NightOwl rules block. */
export function buildRulesBlock(innerMarkdown: string): string {
  const body = innerMarkdown.replace(/^\n+/, '').replace(/\n+$/, '');
  return `${RULES_MARKER_START}\n${body}\n${RULES_MARKER_END}\n`;
}

export type UpsertRulesBlockResult =
  | { readonly ok: true; readonly content: string; readonly warning?: string }
  | { readonly ok: false; readonly error: string };

function spliceBlock(before: string, block: string, after: string): string {
  const normalized = block.endsWith('\n') ? block : `${block}\n`;
  let head = before;
  if (head.length > 0 && !head.endsWith('\n')) head = `${head}\n`;
  // Drop one leading newline from after so we do not keep an extra blank after the end marker line.
  const tail = after.startsWith('\n') ? after.slice(1) : after;
  return `${head}${normalized}${tail}`.replace(/\n{3,}/g, '\n\n');
}

/**
 * Insert or replace the NightOwl rules block inside a project file.
 * When force is true and markers are skewed, replaces from the first start (or legacy marker) to the last end when possible.
 */
export function upsertRulesBlock(fileContent: string, block: string, force = false): UpsertRulesBlockResult {
  const starts = countOccurrences(fileContent, RULES_MARKER_START);
  const ends = countOccurrences(fileContent, RULES_MARKER_END);
  const legacyAt = fileContent.indexOf(RULES_MARKER);
  const hasLegacyOnly = legacyAt !== -1 && starts === 0 && ends === 0;

  if (starts === 0 && ends === 0 && !hasLegacyOnly) {
    if (fileContent.length === 0) return { ok: true, content: block.endsWith('\n') ? block : `${block}\n` };
    const head = fileContent.endsWith('\n') ? fileContent : `${fileContent}\n`;
    const normalized = block.endsWith('\n') ? block : `${block}\n`;
    return { ok: true, content: `${head}${normalized}` };
  }

  if (hasCompleteRulesBlock(fileContent)) {
    const startAt = fileContent.indexOf(RULES_MARKER_START);
    const endAt = fileContent.indexOf(RULES_MARKER_END) + RULES_MARKER_END.length;
    return { ok: true, content: spliceBlock(fileContent.slice(0, startAt), block, fileContent.slice(endAt)) };
  }

  if (force) {
    if (starts >= 1 && ends >= 1) {
      const startAt = fileContent.indexOf(RULES_MARKER_START);
      const endAt = fileContent.lastIndexOf(RULES_MARKER_END) + RULES_MARKER_END.length;
      if (startAt < endAt) {
        return { ok: true, content: spliceBlock(fileContent.slice(0, startAt), block, fileContent.slice(endAt)) };
      }
      return {
        ok: false,
        error: 'NightOwl rules end marker appears before start marker; edit the file manually',
      };
    }
    if (hasLegacyOnly) {
      const afterLegacy = fileContent.slice(legacyAt + RULES_MARKER.length).trim();
      const content = spliceBlock(fileContent.slice(0, legacyAt), block, '');
      if (afterLegacy.length === 0) return { ok: true, content };
      return {
        ok: true,
        content,
        warning: 'legacy NightOwl marker has no end boundary; content after the marker was dropped',
      };
    }
    return {
      ok: false,
      error: 'NightOwl rules markers are missing or mismatched; edit the file manually',
    };
  }

  return {
    ok: false,
    error:
      'NightOwl rules markers are missing or mismatched; fix the file or pass --force only if a recoverable block boundary exists',
  };
}

function formatInner(rules: readonly SuggestedRule[], generatedAt: string): string {
  if (rules.length === 0) {
    return ['# NightOwl suggested rules', '', '_No clusters met the threshold._'].join('\n');
  }
  const sections = rules.map((rule, index) => {
    const meta = `category=\`${rule.cluster.category}\` · module=\`${rule.cluster.module}\` · count=${rule.cluster.count} · via=${rule.source}`;
    return `## ${index + 1}. ${rule.title}\n\n${meta}\n\n${rule.body.trim()}`;
  });
  return [
    '# NightOwl suggested rules',
    '',
    `Generated at ${generatedAt}. Review the NightOwl block before relying on it in CLAUDE.md or .cursorrules.`,
    '',
    ...sections,
  ].join('\n');
}

/** Full NightOwl rules document (start/end markers) for stdout or --output. */
export function formatSuggestedRules(rules: readonly SuggestedRule[], generatedAt: string): string {
  return buildRulesBlock(formatInner(rules, generatedAt));
}

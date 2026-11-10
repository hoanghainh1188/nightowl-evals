import type { SuggestedRule } from './types.js';
import { RULES_MARKER } from './types.js';

export function formatSuggestedRules(rules: readonly SuggestedRule[], generatedAt: string): string {
  if (rules.length === 0) {
    return `${RULES_MARKER}\n\n# NightOwl suggested rules\n\n_No clusters met the threshold._\n`;
  }
  const sections = rules.map((rule, index) => {
    const meta = `category=\`${rule.cluster.category}\` · module=\`${rule.cluster.module}\` · count=${rule.cluster.count} · via=${rule.source}`;
    return `## ${index + 1}. ${rule.title}\n\n${meta}\n\n${rule.body.trim()}\n`;
  });
  return [
    RULES_MARKER,
    '',
    '# NightOwl suggested rules',
    '',
    `Generated at ${generatedAt}. Paste reviewed sections into CLAUDE.md or .cursorrules.`,
    '',
    ...sections,
  ].join('\n');
}

export function hasRulesMarker(content: string): boolean {
  return content.includes(RULES_MARKER);
}

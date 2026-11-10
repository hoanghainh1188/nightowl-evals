import { containsInlineSecret } from '../hooks/claude-code/sensitive.js';
import { truncateUtf8 } from '../shared/truncate.js';
import { unifiedDiff } from '../classify/diff.js';
import { clusterFailures, withSnippet } from './cluster.js';
import type { FailureForRules, RuleCluster, SuggestedRule } from './types.js';

const MAX_SNIPPET = 800;

const TITLES: Readonly<Record<string, string>> = Object.freeze({
  convention: 'Follow project conventions in this module',
  'missing-context': 'Load required project context before editing',
  logic: 'Handle edge cases correctly',
  'misread-requirement': 'Match the stated requirement exactly',
  unclassified: 'Avoid repeating recent AI mistakes',
});

function safeSnippet(ai: string, final: string): string | null {
  if (containsInlineSecret(ai) || containsInlineSecret(final)) return null;
  const diff = unifiedDiff(ai, final);
  if (diff === null) return null;
  if (containsInlineSecret(diff)) return null;
  const { text, truncated } = truncateUtf8(diff, MAX_SNIPPET);
  return truncated ? `${text}\n…` : text;
}

function bodyFor(cluster: RuleCluster): string {
  const agent = cluster.agent ? ` (agent: \`${cluster.agent}\`)` : '';
  const paths = cluster.samplePaths.map((p) => `- \`${p}\``).join('\n');
  const reasons =
    cluster.reasonHints.length === 0
      ? ''
      : `\n\nClassifier hints:\n${cluster.reasonHints.map((r) => `- ${r}`).join('\n')}`;
  const snippet =
    cluster.snippet === null
      ? '\n\n_(code sample omitted: missing, too large, or secret-filtered)_'
      : `\n\nExample diff developers applied (${cluster.count} similar failures${agent}):\n\`\`\`diff\n${cluster.snippet}\n\`\`\``;
  return (
    `When editing files under \`${cluster.module}\`, prefer the patterns already used in this codebase` +
    ` for **${cluster.category}** issues.${reasons}\n\nSeen in:\n${paths}${snippet}\n\n` +
    `_Review before pasting into CLAUDE.md / .cursorrules._`
  );
}

export function buildHeuristicRules(
  failures: readonly FailureForRules[],
  options: { readonly minCount?: number; readonly depth?: number; readonly limit?: number } = {},
): readonly SuggestedRule[] {
  const byId = new Map(failures.map((f) => [f.id, f]));
  const clusters = clusterFailures(failures, options).map((cluster) => {
    const sample = byId.get(cluster.sampleIds[0] ?? -1);
    const snippet = sample === undefined ? null : safeSnippet(sample.aiContent, sample.finalContent);
    return withSnippet(cluster, snippet);
  });

  return Object.freeze(
    clusters.map((cluster) =>
      Object.freeze({
        title: TITLES[cluster.category] ?? TITLES.unclassified!,
        body: bodyFor(cluster),
        cluster,
        source: 'heuristic' as const,
      }),
    ),
  );
}

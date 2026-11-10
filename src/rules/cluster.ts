import { moduleOf } from '../report/module.js';
import type { FailureForRules, RuleCluster } from './types.js';
import { DEFAULT_DEPTH } from './types.js';

function clusterKey(category: string, module: string, agent: string | null): string {
  return `${category}\0${module}\0${agent ?? ''}`;
}

export function clusterFailures(
  failures: readonly FailureForRules[],
  options: { readonly minCount?: number; readonly depth?: number; readonly limit?: number } = {},
): readonly RuleCluster[] {
  const minCount = options.minCount ?? 2;
  const depth = options.depth ?? DEFAULT_DEPTH;
  const limit = options.limit ?? 20;
  const groups = new Map<string, FailureForRules[]>();

  for (const failure of failures) {
    const category = failure.category ?? 'unclassified';
    const module = moduleOf(failure.filePath, depth);
    const key = clusterKey(category, module, failure.agent);
    const list = groups.get(key) ?? [];
    list.push(failure);
    groups.set(key, list);
  }

  const clusters: RuleCluster[] = [];
  for (const [, items] of groups) {
    if (items.length < minCount) continue;
    const first = items[0]!;
    const category = first.category ?? 'unclassified';
    const module = moduleOf(first.filePath, depth);
    const reasons = [
      ...new Set(items.map((f) => f.categoryReason).filter((r): r is string => typeof r === 'string' && r.trim() !== '')),
    ].slice(0, 3);
    clusters.push(
      Object.freeze({
        key: clusterKey(category, module, first.agent),
        category,
        module,
        agent: first.agent,
        count: items.length,
        sampleIds: Object.freeze(items.slice(0, 5).map((f) => f.id)),
        samplePaths: Object.freeze([...new Set(items.map((f) => f.filePath))].slice(0, 5)),
        reasonHints: Object.freeze(reasons),
        snippet: null,
      }),
    );
  }

  return Object.freeze(
    clusters
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category) || a.module.localeCompare(b.module))
      .slice(0, limit),
  );
}

/** Attach a sanitized snippet to a cluster (immutable copy). */
export function withSnippet(cluster: RuleCluster, snippet: string | null): RuleCluster {
  return Object.freeze({ ...cluster, snippet });
}

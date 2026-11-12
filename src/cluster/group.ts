import { moduleLabel } from '../workspace/label.js';
import { fingerprintFailure } from './fingerprint.js';
import {
  CLUSTER_SEP,
  DEFAULT_CLUSTER_DEPTH,
  DEFAULT_CLUSTER_LIMIT,
  DEFAULT_CLUSTER_MIN_COUNT,
  type ClusterableFailure,
  type FailureCluster,
  type GroupFailuresOptions,
} from './types.js';

export function clusterKey(category: string, module: string, agent: string | null, fingerprint: string): string {
  return [category, module, agent ?? '', fingerprint].join(CLUSTER_SEP);
}

export function clusterKeyForFailure(
  failure: ClusterableFailure,
  depth = DEFAULT_CLUSTER_DEPTH,
  workspaces: GroupFailuresOptions['workspaces'] = [],
): string {
  const category = failure.category ?? 'unclassified';
  const module = moduleLabel(failure.filePath, depth, workspaces ?? []);
  const fingerprint = fingerprintFailure(failure.aiContent, failure.finalContent, failure.filePath);
  return clusterKey(category, module, failure.agent, fingerprint);
}

/** Group failures into deterministic clusters (category|module|agent|fingerprint). */
export function groupFailures(
  failures: readonly ClusterableFailure[],
  options: GroupFailuresOptions = {},
): readonly FailureCluster[] {
  const minCount = options.minCount ?? DEFAULT_CLUSTER_MIN_COUNT;
  const depth = options.depth ?? DEFAULT_CLUSTER_DEPTH;
  const limit = options.limit ?? DEFAULT_CLUSTER_LIMIT;
  const excludeDismissed = options.excludeDismissed !== false;
  const workspaces = options.workspaces ?? [];
  const groups = new Map<string, ClusterableFailure[]>();

  for (const failure of failures) {
    if (excludeDismissed && failure.status === 'dismissed') continue;
    const category = failure.category ?? 'unclassified';
    const module = moduleLabel(failure.filePath, depth, workspaces);
    const fingerprint = fingerprintFailure(failure.aiContent, failure.finalContent, failure.filePath);
    const key = clusterKey(category, module, failure.agent, fingerprint);
    const list = groups.get(key) ?? [];
    list.push(failure);
    groups.set(key, list);
  }

  const clusters: FailureCluster[] = [];
  for (const [key, items] of groups) {
    if (items.length < minCount) continue;
    const first = items[0]!;
    const category = first.category ?? 'unclassified';
    const module = moduleLabel(first.filePath, depth, workspaces);
    const fingerprint = key.slice(key.lastIndexOf(CLUSTER_SEP) + 1);
    clusters.push(
      Object.freeze({
        key,
        category,
        module,
        agent: first.agent,
        fingerprint,
        count: items.length,
        sampleIds: Object.freeze(items.slice(0, 5).map((f) => f.id)),
        samplePaths: Object.freeze([...new Set(items.map((f) => f.filePath))].slice(0, 5)),
      }),
    );
  }

  return Object.freeze(
    clusters
      .sort(
        (a, b) =>
          b.count - a.count ||
          a.category.localeCompare(b.category) ||
          a.module.localeCompare(b.module) ||
          a.key.localeCompare(b.key),
      )
      .slice(0, limit),
  );
}

export { fingerprintFailure, normalizeForFingerprint } from './fingerprint.js';
export { clusterKey, clusterKeyForFailure, groupFailures } from './group.js';
export {
  CLUSTER_SEP,
  DEFAULT_CLUSTER_DEPTH,
  DEFAULT_CLUSTER_LIMIT,
  DEFAULT_CLUSTER_MIN_COUNT,
  FINGERPRINT_HEX_LEN,
  type ClusterableFailure,
  type FailureCluster,
  type GroupFailuresOptions,
} from './types.js';

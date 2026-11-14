import { isAnyAgentId } from '../agents/ids.js';
import { isRetentionProfile, type RetentionProfile } from '../storage/prune.js';

export const CONFIG_VERSION = 1 as const;

export const PROJECT_CONFIG_FILE = 'nightowl.config.json';
export const LOCAL_CONFIG_FILE = 'config.local.json';

export interface NightowlConfig {
  readonly failOnRate?: number;
  readonly agents?: readonly string[];
  readonly workspaces?: readonly string[];
  readonly digestLookbackDays?: number;
  readonly pruneProfile?: RetentionProfile;
  readonly redactPaths?: boolean;
}

export const EMPTY_CONFIG: NightowlConfig = Object.freeze({});

const FORBIDDEN = new Set(['apikey', 'api_key', 'token', 'password', 'secret', 'authorization']);

const TOP_KEYS = new Set([
  'version',
  'failOnRate',
  'agents',
  'workspaces',
  'digest',
  'prune',
  'privacy',
]);

function rejectForbiddenKeys(value: unknown, path: string): string | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (FORBIDDEN.has(key.toLowerCase())) {
      return `forbidden key ${JSON.stringify(key)} at ${path} (secrets must not appear in config)`;
    }
    const nested = rejectForbiddenKeys((value as Record<string, unknown>)[key], `${path}.${key}`);
    if (nested !== null) return nested;
  }
  return null;
}

function asObject(value: unknown, label: string): Record<string, unknown> | string {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return `${label} must be a JSON object`;
  }
  return value as Record<string, unknown>;
}

/** Parse and validate a raw JSON value into a NightowlConfig (no merge). */
export function parseConfigValue(raw: unknown, label: string): NightowlConfig | string {
  const forbidden = rejectForbiddenKeys(raw, label);
  if (forbidden !== null) return forbidden;

  const obj = asObject(raw, label);
  if (typeof obj === 'string') return obj;

  for (const key of Object.keys(obj)) {
    if (!TOP_KEYS.has(key)) return `unknown key ${JSON.stringify(key)} in ${label}`;
  }

  if (!Object.hasOwn(obj, 'version')) return `${label} missing required "version"`;
  if (obj.version !== CONFIG_VERSION) {
    return `${label} unsupported version ${JSON.stringify(obj.version)} (supported: ${CONFIG_VERSION})`;
  }

  const out: {
    failOnRate?: number;
    agents?: readonly string[];
    workspaces?: readonly string[];
    digestLookbackDays?: number;
    pruneProfile?: RetentionProfile;
    redactPaths?: boolean;
  } = {};

  if (Object.hasOwn(obj, 'failOnRate')) {
    const rate = obj.failOnRate;
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0 || rate > 100) {
      return `${label}.failOnRate must be a number from 0 to 100`;
    }
    out.failOnRate = rate;
  }

  if (Object.hasOwn(obj, 'agents')) {
    if (!Array.isArray(obj.agents) || obj.agents.some((a) => typeof a !== 'string')) {
      return `${label}.agents must be an array of strings`;
    }
    for (const id of obj.agents) {
      if (!isAnyAgentId(id)) return `${label}.agents: unknown agent id ${JSON.stringify(id)}`;
    }
    out.agents = Object.freeze([...obj.agents]);
  }

  if (Object.hasOwn(obj, 'workspaces')) {
    if (!Array.isArray(obj.workspaces) || obj.workspaces.some((w) => typeof w !== 'string')) {
      return `${label}.workspaces must be an array of strings`;
    }
    if (obj.workspaces.some((w) => (w as string).trim() === '')) {
      return `${label}.workspaces entries must be non-empty`;
    }
    out.workspaces = Object.freeze([...(obj.workspaces as string[])]);
  }

  if (Object.hasOwn(obj, 'digest')) {
    const digest = asObject(obj.digest, `${label}.digest`);
    if (typeof digest === 'string') return digest;
    for (const key of Object.keys(digest)) {
      if (key !== 'lookbackDays') return `unknown key ${JSON.stringify(key)} in ${label}.digest`;
    }
    if (Object.hasOwn(digest, 'lookbackDays')) {
      const days = digest.lookbackDays;
      if (typeof days !== 'number' || !Number.isInteger(days) || days < 1 || days > 365) {
        return `${label}.digest.lookbackDays must be an integer from 1 to 365`;
      }
      out.digestLookbackDays = days;
    }
  }

  if (Object.hasOwn(obj, 'prune')) {
    const prune = asObject(obj.prune, `${label}.prune`);
    if (typeof prune === 'string') return prune;
    for (const key of Object.keys(prune)) {
      if (key !== 'profile') return `unknown key ${JSON.stringify(key)} in ${label}.prune`;
    }
    if (Object.hasOwn(prune, 'profile')) {
      if (typeof prune.profile !== 'string' || !isRetentionProfile(prune.profile)) {
        return `${label}.prune.profile must be one of: short, default, long`;
      }
      out.pruneProfile = prune.profile;
    }
  }

  if (Object.hasOwn(obj, 'privacy')) {
    const privacy = asObject(obj.privacy, `${label}.privacy`);
    if (typeof privacy === 'string') return privacy;
    for (const key of Object.keys(privacy)) {
      if (key !== 'redactPaths') return `unknown key ${JSON.stringify(key)} in ${label}.privacy`;
    }
    if (Object.hasOwn(privacy, 'redactPaths')) {
      if (typeof privacy.redactPaths !== 'boolean') {
        return `${label}.privacy.redactPaths must be a boolean`;
      }
      out.redactPaths = privacy.redactPaths;
    }
  }

  return Object.freeze(out);
}

/** Merge overlay onto base (overlay wins per field). */
export function mergeConfigs(base: NightowlConfig, overlay: NightowlConfig): NightowlConfig {
  return Object.freeze({
    ...(base.failOnRate !== undefined ? { failOnRate: base.failOnRate } : {}),
    ...(base.agents !== undefined ? { agents: base.agents } : {}),
    ...(base.workspaces !== undefined ? { workspaces: base.workspaces } : {}),
    ...(base.digestLookbackDays !== undefined ? { digestLookbackDays: base.digestLookbackDays } : {}),
    ...(base.pruneProfile !== undefined ? { pruneProfile: base.pruneProfile } : {}),
    ...(base.redactPaths !== undefined ? { redactPaths: base.redactPaths } : {}),
    ...(overlay.failOnRate !== undefined ? { failOnRate: overlay.failOnRate } : {}),
    ...(overlay.agents !== undefined ? { agents: overlay.agents } : {}),
    ...(overlay.workspaces !== undefined ? { workspaces: overlay.workspaces } : {}),
    ...(overlay.digestLookbackDays !== undefined ? { digestLookbackDays: overlay.digestLookbackDays } : {}),
    ...(overlay.pruneProfile !== undefined ? { pruneProfile: overlay.pruneProfile } : {}),
    ...(overlay.redactPaths !== undefined ? { redactPaths: overlay.redactPaths } : {}),
  });
}

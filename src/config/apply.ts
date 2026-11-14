import type { RetentionProfile } from '../storage/prune.js';
import type { NightowlConfig } from './schema.js';

/** CLI value wins when present (non-null / non-empty as defined by caller). */
export function pickFailOnRate(cli: number | null, config: NightowlConfig): number | null {
  if (cli !== null) return cli;
  return config.failOnRate ?? null;
}

export function pickAgents(
  cli: readonly string[] | null,
  config: NightowlConfig,
): readonly string[] | null {
  if (cli !== null) return cli;
  return config.agents ?? null;
}

/** CLI workspaces win when the array is non-empty (flags were passed). */
export function pickWorkspaces(cli: readonly string[], config: NightowlConfig): readonly string[] {
  if (cli.length > 0) return cli;
  return config.workspaces ?? [];
}

/** When CLI did not pass --since, optional lookback days from config. */
export function pickDigestLookbackDays(
  sinceOptionPresent: boolean,
  config: NightowlConfig,
): number | undefined {
  if (sinceOptionPresent) return undefined;
  return config.digestLookbackDays;
}

export function pickPruneProfile(
  cliProfile: RetentionProfile | null,
  daysExplicit: boolean,
  config: NightowlConfig,
): RetentionProfile | null {
  if (cliProfile !== null || daysExplicit) return cliProfile;
  return config.pruneProfile ?? null;
}

/**
 * Effective path redaction.
 * - cliExplicit true/false: use CLI
 * - otherwise: config value if set, else commandDefault
 */
export function pickRedactPaths(
  cliExplicit: boolean | undefined,
  config: NightowlConfig,
  commandDefault: boolean,
): boolean {
  if (cliExplicit !== undefined) return cliExplicit;
  if (config.redactPaths !== undefined) return config.redactPaths;
  return commandDefault;
}

import type { Digest } from '../digest/build.js';
import type { Report } from '../report/build.js';

export const PACK_REPORT_FILE = 'report.md';
export const PACK_DIGEST_FILE = 'digest.md';
export const PACK_MANIFEST_FILE = 'manifest.json';

export interface SharePackManifest {
  readonly generatedAt: string;
  readonly since: string;
  readonly redactPaths: boolean;
  readonly files: readonly string[];
  readonly nightowlVersion?: string;
  readonly note: string;
}

export interface SharePackContents {
  readonly reportMd: string;
  readonly digestMd: string;
  readonly manifest: SharePackManifest;
}

export function buildSharePackManifest(input: {
  readonly generatedAt: string;
  readonly since: string;
  readonly redactPaths: boolean;
  readonly nightowlVersion?: string | undefined;
}): SharePackManifest {
  const files = Object.freeze([PACK_REPORT_FILE, PACK_DIGEST_FILE, PACK_MANIFEST_FILE]);
  const base = {
    generatedAt: input.generatedAt,
    since: input.since,
    redactPaths: input.redactPaths,
    files,
    note: 'Local-only NightOwl share pack. No network upload. Grades AI, not people — no developer names.',
  };
  if (input.nightowlVersion === undefined) return Object.freeze(base);
  return Object.freeze({ ...base, nightowlVersion: input.nightowlVersion });
}

export function stampFromIso(iso: string): string {
  return iso.replace(/[:.]/g, '-');
}

/** Ensure pack payload types stay tied to report/digest builders. */
export type SharePackReport = Report;
export type SharePackDigest = Digest;

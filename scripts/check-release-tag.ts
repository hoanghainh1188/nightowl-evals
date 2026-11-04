// Run by the release workflow (`node scripts/check-release-tag.ts`): the pushed tag must be
// `v` + the version in package.json. Only erasable TypeScript, so Node runs it without a build.
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export interface ReleaseInfo {
  readonly version: string;
  readonly prerelease: boolean;
  readonly distTag: 'latest' | 'next';
}

// Semver without build metadata (npm ignores `+build`, so such a tag could not match): numeric
// parts and numeric pre-release identifiers have no leading zeros.
const NUMBER = '(?:0|[1-9]\\d*)';
const PRE_ID = '(?:0|[1-9]\\d*|\\d*[A-Za-z-][0-9A-Za-z-]*)';
const RELEASE_TAG = new RegExp(`^v(${NUMBER}\\.${NUMBER}\\.${NUMBER}(?:-${PRE_ID}(?:\\.${PRE_ID})*)?)$`);

export function checkReleaseTag(tag: string, packageVersion: string): ReleaseInfo {
  const match = RELEASE_TAG.exec(tag);
  if (match === null) throw new Error(`'${tag}' is not a release tag; expected v<major>.<minor>.<patch>[-<pre-release>]`);
  const version = match[1] as string;
  if (version !== packageVersion) {
    throw new Error(`tag ${tag} does not match package.json version ${packageVersion}; bump the version in a PR first`);
  }
  const prerelease = version.includes('-');
  return { version, prerelease, distTag: prerelease ? 'next' : 'latest' };
}

function main(): void {
  try {
    const { version: packageVersion } = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as { version: string };
    const info = checkReleaseTag(process.env.RELEASE_TAG ?? '', packageVersion);
    const outputs = `version=${info.version}\ndist_tag=${info.distTag}\nprerelease=${String(info.prerelease)}\n`;
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, outputs);
    process.stdout.write(`Releasing ${info.version} under the npm dist-tag ${info.distTag}.\n`);
  } catch (error) {
    // Newlines would end the annotation early; the message holds the tag, which the user chose.
    process.stdout.write(`::error::${(error as Error).message.replace(/[\r\n]/g, ' ')}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();

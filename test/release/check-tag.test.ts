import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkReleaseTag } from '../../scripts/check-release-tag.js';
import { createTempDir, type TempDir } from '../helpers/temp-repo.js';

const SCRIPT = join(import.meta.dirname, '../../scripts/check-release-tag.ts');

describe('checkReleaseTag', () => {
  it('accepts a tag that matches the package version', () => {
    expect(checkReleaseTag('v0.2.0', '0.2.0')).toEqual({ version: '0.2.0', prerelease: false, distTag: 'latest' });
  });

  it('publishes a pre-release under next', () => {
    expect(checkReleaseTag('v0.2.0-beta.1', '0.2.0-beta.1')).toEqual({ version: '0.2.0-beta.1', prerelease: true, distTag: 'next' });
  });

  it('names both versions when they differ', () => {
    expect(() => checkReleaseTag('v0.3.0', '0.2.0')).toThrow(/v0\.3\.0.*0\.2\.0/);
  });

  it.each(['0.2.0', 'v0.2', 'v0.2.0+build.1', 'v0.2.0;rm -rf /', 'release-0.2.0', '', 'v01.2.0', 'v0.2.0-01', 'v0.2.0-', 'v0.2.0\n'])('rejects the tag %j', (tag) => {
    expect(() => checkReleaseTag(tag, '0.2.0')).toThrow(/not a release tag/);
  });
});

describe('check-release-tag script', () => {
  let dir: TempDir;
  beforeEach(async () => {
    dir = await createTempDir();
    await writeFile(join(dir.path, 'package.json'), JSON.stringify({ name: 'x', version: '0.2.0-rc.1' }));
  });
  afterEach(() => dir.cleanup());

  const run = (tag: string, output: string | null) =>
    spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', SCRIPT], {
      cwd: dir.path,
      env: { PATH: process.env.PATH, RELEASE_TAG: tag, ...(output === null ? {} : { GITHUB_OUTPUT: output }) },
      encoding: 'utf8',
    });

  it('writes version, dist-tag and pre-release flag to the step outputs', async () => {
    await mkdir(join(dir.path, 'gh'));
    const output = join(dir.path, 'gh', 'out');
    await writeFile(output, '');
    const result = run('v0.2.0-rc.1', output);
    expect(result.status).toBe(0);
    expect(await readFile(output, 'utf8')).toBe('version=0.2.0-rc.1\ndist_tag=next\nprerelease=true\n');
  });

  it('fails with a GitHub error annotation on a mismatch', () => {
    const result = run('v0.2.0', null);
    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/^::error::.*v0\.2\.0.*0\.2\.0-rc\.1/m);
  });
});

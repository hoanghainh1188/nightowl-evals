import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const WORKFLOW = join(import.meta.dirname, '../../.github/workflows/release.yml');

// The workflow publishes to npm, so its safety rules are checked as text: no YAML library needed.
function job(text: string, name: string): string {
  const start = text.indexOf(`\n  ${name}:\n`);
  if (start === -1) throw new Error(`job ${name} not found`);
  const next = text.slice(start + 1).search(/\n {2}[a-z][\w-]*:\n/);
  return next === -1 ? text.slice(start) : text.slice(start, start + 1 + next);
}

// Every `run:` script, so expressions cannot be spliced into shell code.
function runScripts(text: string): string[] {
  const lines = text.split('\n');
  const scripts: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const match = /^(\s*)(?:- )?run: (.*)$/.exec(lines[i] as string);
    if (match === null) continue;
    if (match[2] !== '|') {
      scripts.push(match[2] as string);
      continue;
    }
    const indent = (match[1] as string).length;
    const body: string[] = [];
    while (i + 1 < lines.length && ((lines[i + 1] as string).trim() === '' || /^\s*/.exec(lines[i + 1] as string)![0].length > indent)) {
      body.push(lines[(i += 1)] as string);
    }
    scripts.push(body.join('\n'));
  }
  return scripts;
}

describe('release workflow', () => {
  let text: string;
  beforeAll(async () => {
    text = await readFile(WORKFLOW, 'utf8');
  });

  it('runs on v* tags only', () => {
    expect(text).toMatch(/\non:\n {2}push:\n {4}tags: \['v\*'\]\n\n/);
  });

  it('gives the OIDC token to the publish job only, and write access to the release job only', () => {
    expect(text).toMatch(/\npermissions:\n {2}contents: read\n/);
    const publish = job(text, 'publish');
    expect(publish).toMatch(/\n {4}environment: npm\n/);
    expect(publish).toMatch(/\n {4}permissions:\n {6}id-token: write\n(?! {6})/);
    expect(job(text, 'release')).toMatch(/\n {4}permissions:\n {6}contents: write\n(?! {6})/);
    expect(job(text, 'verify')).not.toContain('permissions:');
  });

  it('publishes the tarball verify built, running no package code next to the OIDC token', () => {
    const verify = job(text, 'verify');
    expect(verify).toContain('npm pack --json');
    expect(verify).toMatch(/uses: actions\/upload-artifact@/);
    const publish = job(text, 'publish');
    for (const forbidden of ['actions/checkout', 'npm ci', 'npm install', 'npm run']) expect(publish).not.toContain(forbidden);
    expect(publish).toMatch(/uses: actions\/download-artifact@/);
    expect(publish).toContain('sha256sum --check');
    expect(publish).toContain('npm publish "$TARBALL" --access public --tag "$DIST_TAG" --ignore-scripts');
    expect(publish).toMatch(/node-version: '24\.\d+\.\d+'/);
  });

  it('pins every action to a full commit SHA', () => {
    const uses = [...text.matchAll(/uses: (\S+)/g)].map((m) => m[1] as string);
    expect(uses.length).toBeGreaterThan(0);
    for (const action of uses) expect(action).toMatch(/@[0-9a-f]{40}$/);
  });

  it('checks the tag and that its commit is on main before anything is published', () => {
    const verify = job(text, 'verify');
    expect(verify).toContain('node scripts/check-release-tag.ts');
    expect(verify).toContain('git merge-base --is-ancestor "$GITHUB_SHA" origin/main');
    for (const step of ['npm run typecheck', 'npm run test:coverage', 'npm run build', 'npm pack --json', 'npm run spec:validate']) {
      expect(verify).toContain(step);
    }
    expect(job(text, 'publish')).toMatch(/\n {4}needs: verify\n/);
  });

  it('publishes with trusted publishing, never with a stored token', () => {
    expect(text).not.toMatch(/NPM_TOKEN|secrets\./);
    expect(job(text, 'publish')).toContain('11.5.1');
  });

  it('skips what is already done when run again, and fails on any other error', () => {
    const publish = job(text, 'publish');
    expect(publish).toContain('npm view "$NAME@$VERSION" version');
    expect(publish).toContain('E404');
    const release = job(text, 'release');
    expect(release).toContain('gh release view "$TAG"');
    expect(release).toContain('release not found');
  });

  it('never splices ${{ }} expressions into shell code', () => {
    const scripts = runScripts(text);
    expect(scripts.length).toBeGreaterThan(5);
    for (const script of scripts) expect(script).not.toContain('${{');
  });

  it('runs each tag on its own and never cancels a release halfway through', () => {
    expect(text).toMatch(/\nconcurrency:\n {2}group: release-\$\{\{ github\.ref \}\}\n {2}cancel-in-progress: false\n/);
  });
});

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const ACTION_YML = join(import.meta.dirname, '../../action/action.yml');
const README = join(import.meta.dirname, '../../README.md');

describe('github action action.yml', () => {
  let text: string;
  let readme: string;

  beforeAll(async () => {
    text = await readFile(ACTION_YML, 'utf8');
    readme = await readFile(README, 'utf8');
  });

  it('is a composite action with required inputs and defaults', () => {
    expect(text).toMatch(/\nruns:\n {2}using: composite\n/);
    for (const input of [
      'fail-on-rate',
      'since',
      'output-path',
      'working-directory',
      'nightowl-version',
      'comment-on-pr',
      'github-token',
      'junit-path',
    ]) {
      expect(text).toContain(`\n  ${input}:\n`);
    }
    expect(text).toMatch(/fail-on-rate:[\s\S]*?default: '25'/);
    expect(text).toMatch(/output-path:[\s\S]*?default: nightowl-report\.json/);
    expect(text).toMatch(/nightowl-version:[\s\S]*?default: latest/);
    expect(text).toMatch(/comment-on-pr:[\s\S]*?default: 'true'/);
  });

  it('pins setup-node to a full commit SHA and installs the npm package', () => {
    expect(text).toMatch(/uses: actions\/setup-node@[0-9a-f]{40}/);
    expect(text).toContain('npm install -g "@hoanghainh/nightowl-evals@${NIGHTOWL_VERSION}"');
    expect(text).toContain('nightowl report');
    expect(text).toContain('nightowl ingest-ci');
    expect(text).toContain('--fail-on-rate');
    expect(text).toContain('--json');
    expect(text).toContain('--output');
  });

  it('preflights the database and skips API when comment is off', () => {
    expect(text).toContain('.nightowl/nightowl.db');
    expect(text).toContain('Missing');
    expect(text).toContain('download-artifact');
    expect(text).toContain('actions/cache');
    expect(text).toContain('Warn when database has no failures');
    expect(text).toContain('::warning::');
    expect(text).toContain('j.total');
    expect(text).toContain('SINCE: ${{ inputs.since }}');
    expect(text).toMatch(
      /if: \$\{\{ always\(\) && inputs\.comment-on-pr == 'true' && github\.event_name == 'pull_request' && github\.event\.pull_request\.head\.repo\.full_name == github\.repository \}\}/,
    );
    expect(text).toContain('scripts/post-comment.sh');
  });

  it('README documents uses path, inputs, permissions, and DB restore', () => {
    expect(readme).toContain('hoanghainh1188/nightowl-evals/action@');
    expect(readme).toContain('fail-on-rate');
    expect(readme).toContain('pull-requests: write');
    expect(readme).toContain('gitignored');
    expect(readme).toContain('comment-on-pr');
    expect(readme).toContain('junit-path');
    expect(readme).toContain('ingest-ci');
    expect(readme).toContain('actions/download-artifact@v4');
    expect(readme).toContain('actions/cache@v4');
    expect(readme).toContain('nightowl-db');
  });
});

import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import pkg from '../../package.json' with { type: 'json' };

const ROOT = join(import.meta.dirname, '../..');
const REPO = 'https://github.com/hoanghainh1188/nightowl-evals';

describe('package metadata for publishing', () => {
  it('names the repository exactly, as trusted publishing requires', () => {
    expect(pkg).toMatchObject({
      repository: { type: 'git', url: `git+${REPO}.git` },
      homepage: `${REPO}#readme`,
      bugs: { url: `${REPO}/issues` },
      publishConfig: { access: 'public' },
    });
  });

  it('builds before packing', () => {
    expect((pkg.scripts as Record<string, string>).prepack).toBe('npm run build');
  });

  it('packs the CLI, the licence files and the README only', () => {
    const output = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: ROOT, encoding: 'utf8' });
    const files = (JSON.parse(output) as Array<{ files: Array<{ path: string }> }>)[0]?.files.map((f) => f.path).sort();
    expect(files).toEqual(['LICENSE', 'NOTICE', 'README.md', 'dist/bin.js', 'package.json']);
  });
});

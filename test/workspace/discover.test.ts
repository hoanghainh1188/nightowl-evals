import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  discoverWorkspaces,
  findNearestWorkspace,
  moduleLabel,
  parsePnpmWorkspaceYaml,
  resolveWorkspaceSelection,
} from '../../src/workspace/index.js';
import { createTempDir, type TempDir } from '../helpers/temp-repo.js';

describe('parsePnpmWorkspaceYaml', () => {
  it('reads package globs from a simple yaml list', () => {
    expect(
      parsePnpmWorkspaceYaml(`packages:\n  - 'packages/*'\n  - apps/*\n`),
    ).toEqual(['packages/*', 'apps/*']);
  });
});

describe('discoverWorkspaces + moduleLabel', () => {
  let dir: TempDir;
  afterEach(() => dir?.cleanup());

  async function fixture(kind: 'npm' | 'pnpm' | 'none'): Promise<string> {
    dir = await createTempDir();
    const root = dir.path;
    await mkdir(join(root, 'packages', 'ui', 'src'), { recursive: true });
    await mkdir(join(root, 'packages', 'api', 'src'), { recursive: true });
    await writeFile(join(root, 'packages', 'ui', 'package.json'), JSON.stringify({ name: '@acme/ui' }));
    await writeFile(join(root, 'packages', 'api', 'package.json'), JSON.stringify({ name: '@acme/api' }));
    if (kind === 'npm') {
      await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'root', workspaces: ['packages/*'] }));
    } else if (kind === 'pnpm') {
      await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'root' }));
      await writeFile(join(root, 'pnpm-workspace.yaml'), "packages:\n  - 'packages/*'\n");
    } else {
      await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'root' }));
    }
    return root;
  }

  it('returns empty when no workspace config', async () => {
    const root = await fixture('none');
    expect(await discoverWorkspaces(root)).toEqual([]);
    expect(moduleLabel('packages/ui/src/a.ts', 2, [])).toBe('packages/ui');
  });

  it('discovers npm workspaces and labels by package name', async () => {
    const root = await fixture('npm');
    const ws = await discoverWorkspaces(root);
    expect(ws.map((w) => [w.path, w.name])).toEqual([
      ['packages/api', '@acme/api'],
      ['packages/ui', '@acme/ui'],
    ]);
    expect(moduleLabel('packages/ui/src/Button.tsx', 1, ws)).toBe('@acme/ui');
    expect(moduleLabel('README.md', 2, ws)).toBe('(root)');
    expect(findNearestWorkspace('packages/api/src/x.ts', ws)?.path).toBe('packages/api');
  });

  it('discovers pnpm-workspace.yaml', async () => {
    const root = await fixture('pnpm');
    const ws = await discoverWorkspaces(root);
    expect(ws.some((w) => w.path === 'packages/ui')).toBe(true);
  });

  it('resolves --workspace by name or path and rejects unknown', () => {
    const discovered = [
      { path: 'packages/ui', name: '@acme/ui' },
      { path: 'packages/api', name: '@acme/api' },
    ];
    expect(resolveWorkspaceSelection(['@acme/ui'], discovered)).toEqual([discovered[0]]);
    expect(resolveWorkspaceSelection(['packages/api'], discovered)).toEqual([discovered[1]]);
    expect(resolveWorkspaceSelection(['nope'], discovered)).toMatch(/unknown --workspace/);
  });

  it('filters nested packages by nearest workspace, not parent prefix', async () => {
    const { filterPathsByWorkspaces } = await import('../../src/workspace/match.js');
    const all = [
      { path: 'packages/ui', name: '@acme/ui' },
      { path: 'packages/ui/sub', name: '@acme/ui-sub' },
    ];
    const rows = [
      { filePath: 'packages/ui/src/a.ts' },
      { filePath: 'packages/ui/sub/src/b.ts' },
    ];
    expect(filterPathsByWorkspaces(rows, [all[0]!], all)).toEqual([{ filePath: 'packages/ui/src/a.ts' }]);
    expect(filterPathsByWorkspaces(rows, [all[1]!], all)).toEqual([{ filePath: 'packages/ui/sub/src/b.ts' }]);
  });
});

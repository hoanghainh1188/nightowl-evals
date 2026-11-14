import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  loadNightowlConfig,
  localConfigPath,
  projectConfigPath,
} from '../../src/config/load.js';
import { pickFailOnRate, pickRedactPaths, pickWorkspaces } from '../../src/config/apply.js';
import { createTempDir, type TempDir } from '../helpers/temp-repo.js';

describe('loadNightowlConfig', () => {
  let root: TempDir;

  beforeEach(async () => {
    root = await createTempDir();
  });

  afterEach(async () => {
    await root.cleanup();
  });

  it('returns empty defaults when no files exist', async () => {
    const result = await loadNightowlConfig({ root: root.path });
    expect(result).toMatchObject({
      ok: true,
      config: {},
      projectPresent: false,
      localPresent: false,
    });
  });

  it('loads project config alone', async () => {
    await writeFile(
      projectConfigPath(root.path),
      JSON.stringify({ version: 1, failOnRate: 15, privacy: { redactPaths: true } }),
    );
    const result = await loadNightowlConfig({ root: root.path });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config).toEqual({ failOnRate: 15, redactPaths: true });
    expect(result.projectPresent).toBe(true);
  });

  it('merges local overlay over project', async () => {
    await writeFile(projectConfigPath(root.path), JSON.stringify({ version: 1, failOnRate: 10 }));
    await mkdir(join(root.path, '.nightowl'), { recursive: true });
    await writeFile(localConfigPath(root.path), JSON.stringify({ version: 1, failOnRate: 30 }));
    const result = await loadNightowlConfig({ root: root.path });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.failOnRate).toBe(30);
  });

  it('errors on invalid JSON and unknown keys', async () => {
    await writeFile(projectConfigPath(root.path), '{nope');
    expect(await loadNightowlConfig({ root: root.path })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/invalid JSON/),
    });

    await writeFile(projectConfigPath(root.path), JSON.stringify({ version: 1, weird: true }));
    expect(await loadNightowlConfig({ root: root.path })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/unknown key "weird"/),
    });
  });

  it('honors --config path override for project file', async () => {
    const alt = join(root.path, 'alt.config.json');
    await writeFile(alt, JSON.stringify({ version: 1, failOnRate: 42 }));
    const result = await loadNightowlConfig({ root: root.path, configPath: alt });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.failOnRate).toBe(42);
  });

  it('resolves relative --config against cwd', async () => {
    const sub = join(root.path, 'ci');
    await mkdir(sub);
    await writeFile(join(sub, 'team.json'), JSON.stringify({ version: 1, failOnRate: 5 }));
    const result = await loadNightowlConfig({
      root: root.path,
      cwd: sub,
      configPath: 'team.json',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.failOnRate).toBe(5);
  });

  it('errors when --config path is missing', async () => {
    const result = await loadNightowlConfig({
      root: root.path,
      configPath: join(root.path, 'missing.json'),
    });
    expect(result).toMatchObject({
      ok: false,
      error: expect.stringMatching(/config file not found/),
    });
  });
});

describe('pick helpers (CLI > config)', () => {
  it('prefers CLI fail-on-rate and workspaces', () => {
    expect(pickFailOnRate(40, { failOnRate: 10 })).toBe(40);
    expect(pickFailOnRate(null, { failOnRate: 10 })).toBe(10);
    expect(pickWorkspaces(['a'], { workspaces: ['b'] })).toEqual(['a']);
    expect(pickWorkspaces([], { workspaces: ['b'] })).toEqual(['b']);
  });

  it('applies redactPaths with command defaults', () => {
    expect(pickRedactPaths(undefined, {}, false)).toBe(false);
    expect(pickRedactPaths(undefined, { redactPaths: true }, false)).toBe(true);
    expect(pickRedactPaths(false, { redactPaths: true }, true)).toBe(false);
    expect(pickRedactPaths(true, { redactPaths: false }, false)).toBe(true);
  });
});

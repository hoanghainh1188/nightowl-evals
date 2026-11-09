import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { detectHookManager } from '../../src/setup/hook-manager.js';
import { createFakeRepo, type TempDir, writeFiles } from '../helpers/temp-repo.js';

describe('hook-manager', () => {
  let repo: TempDir;

  beforeEach(async () => {
    repo = await createFakeRepo();
  });

  afterEach(async () => {
    await repo.cleanup();
  });

  it('detects Husky when core.hooksPath includes .husky', () => {
    const manager = detectHookManager(repo.path, '.husky');
    expect(manager.kind).toBe('husky');
    expect(manager.name).toBe('Husky');
    const instructions = manager.getInstructions('pre-commit', 'precommit');
    expect(instructions).toContain('Husky detected (.husky/)');
    expect(instructions).toContain('.husky/pre-commit');
    expect(instructions).toContain('nightowl precommit');
  });

  it('detects Husky when .husky directory exists in repo', async () => {
    await writeFiles(repo.path, {
      '.husky/pre-commit': '#!/bin/sh\n',
    });

    const manager = detectHookManager(repo.path, null);
    expect(manager.kind).toBe('husky');
    expect(manager.name).toBe('Husky');
  });

  it('detects Lefthook when lefthook.yml exists in repo', async () => {
    await writeFiles(repo.path, {
      'lefthook.yml': 'pre-commit:\n  commands:\n',
    });

    const manager = detectHookManager(repo.path, null);
    expect(manager.kind).toBe('lefthook');
    expect(manager.name).toBe('Lefthook');
    expect(manager.configPath).toBe('lefthook.yml');
    const instructions = manager.getInstructions('pre-commit', 'precommit');
    expect(instructions).toContain('Lefthook detected (lefthook.yml)');
    expect(instructions).toContain('pre-commit:');
    expect(instructions).toContain('nightowl:');
    expect(instructions).toContain('nightowl precommit');
  });

  it('detects Lefthook for alternate config filenames (.lefthook.yaml)', async () => {
    await writeFiles(repo.path, {
      '.lefthook.yaml': 'pre-commit:\n',
    });

    const manager = detectHookManager(repo.path, null);
    expect(manager.kind).toBe('lefthook');
    expect(manager.configPath).toBe('.lefthook.yaml');
  });

  it('returns none when no hook manager is detected', () => {
    const manager = detectHookManager(repo.path, null);
    expect(manager.kind).toBe('none');
    expect(manager.name).toBe('Git');
    const instructions = manager.getInstructions('pre-commit', 'precommit');
    expect(instructions).toContain('Add this line to your pre-commit hook yourself');
  });
});

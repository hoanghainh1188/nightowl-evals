import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkClaudeHooks, installClaudeHooks, PersonalSettingsTrackedError } from '../../src/setup/claude-install.js';
import {
  HOOK_COMMAND_LINE,
  hasNightowlHooks,
  LEGACY_HOOK_COMMAND,
  PERSONAL_SETTINGS,
  SHARED_SETTINGS,
} from '../../src/setup/claude-settings.js';
import { createGitRepo, git } from '../helpers/git-repo.js';
import { createFakeRepo, type TempDir } from '../helpers/temp-repo.js';
import { SetupError } from '../../src/setup/fs-utils.js';

describe('installClaudeHooks', () => {
  let repo: TempDir;
  beforeEach(async () => {
    repo = await createGitRepo();
  });
  afterEach(() => repo.cleanup());

  const read = async (file: string) => JSON.parse(await readFile(join(repo.path, file), 'utf8'));
  const exists = (file: string) => readFile(join(repo.path, file)).then(() => true, () => false);
  async function write(file: string, value: unknown): Promise<void> {
    await mkdir(join(repo.path, '.claude'), { recursive: true });
    await writeFile(join(repo.path, file), `${JSON.stringify(value)}\n`);
  }
  const legacy = { hooks: { UserPromptSubmit: [{ hooks: [{ type: 'command', command: LEGACY_HOOK_COMMAND }] }] } };

  it('installs into the personal file by default and keeps it out of git', async () => {
    const result = await installClaudeHooks(repo.path, PERSONAL_SETTINGS);
    expect(result).toMatchObject({ kind: 'installed', file: PERSONAL_SETTINGS, gitignore: 'created' });
    expect(hasNightowlHooks(await read(PERSONAL_SETTINGS))).toBe(true);
    expect(await exists(SHARED_SETTINGS)).toBe(false);
    expect(await readFile(join(repo.path, '.gitignore'), 'utf8')).toBe(`${PERSONAL_SETTINGS}\n`);
    expect(git(repo.path, ['status', '--porcelain', '--untracked-files=all'])).not.toContain('settings.local.json');
  });

  it('adds no .gitignore line when git already ignores the personal file', async () => {
    await writeFile(join(repo.path, '.git/info/exclude'), `${PERSONAL_SETTINGS}\n`);
    const result = await installClaudeHooks(repo.path, PERSONAL_SETTINGS);
    expect(result).toMatchObject({ kind: 'installed', gitignore: 'unchanged' });
    expect(await exists('.gitignore')).toBe(false);
  });

  it('refuses a personal file that git already tracks, changing nothing', async () => {
    await write(PERSONAL_SETTINGS, { permissions: {} });
    git(repo.path, ['add', PERSONAL_SETTINGS]);
    git(repo.path, ['commit', '-q', '-m', 'settings']);
    await expect(installClaudeHooks(repo.path, PERSONAL_SETTINGS)).rejects.toThrow(PersonalSettingsTrackedError);
    expect(await read(PERSONAL_SETTINGS)).toEqual({ permissions: {} });
    expect(await exists('.gitignore')).toBe(false);
  });

  it('installs into the shared file with --shared, without touching .gitignore', async () => {
    const result = await installClaudeHooks(repo.path, SHARED_SETTINGS);
    expect(result).toMatchObject({ kind: 'installed', file: SHARED_SETTINGS, gitignore: 'unchanged' });
    expect(hasNightowlHooks(await read(SHARED_SETTINGS))).toBe(true);
    expect(await exists(PERSONAL_SETTINGS)).toBe(false);
    expect(await exists('.gitignore')).toBe(false);
  });

  it('leaves hooks where they already are, upgrading the legacy form', async () => {
    await write(SHARED_SETTINGS, legacy);
    const result = await installClaudeHooks(repo.path, PERSONAL_SETTINGS);
    expect(result).toEqual({ kind: 'elsewhere', file: SHARED_SETTINGS, upgraded: 1 });
    expect(await exists(PERSONAL_SETTINGS)).toBe(false);
    expect((await read(SHARED_SETTINGS)).hooks.UserPromptSubmit[0].hooks[0].command).toBe(HOOK_COMMAND_LINE);
  });

  it('reports hooks found in both files', async () => {
    await write(SHARED_SETTINGS, legacy);
    await write(PERSONAL_SETTINGS, legacy);
    const result = await installClaudeHooks(repo.path, PERSONAL_SETTINGS);
    expect(result).toMatchObject({ kind: 'installed', file: PERSONAL_SETTINGS, alsoIn: SHARED_SETTINGS });
    expect((await read(SHARED_SETTINGS)).hooks.UserPromptSubmit[0].hooks[0].command).toBe(HOOK_COMMAND_LINE);
  });

  it('reports a git that cannot answer as a setup error, writing nothing', async () => {
    const broken = await createFakeRepo();
    try {
      await expect(installClaudeHooks(broken.path, PERSONAL_SETTINGS)).rejects.toThrow(SetupError);
      await expect(installClaudeHooks(broken.path, PERSONAL_SETTINGS)).rejects.toThrow(/could not check/);
      expect(await readFile(join(broken.path, PERSONAL_SETTINGS)).then(() => true, () => false)).toBe(false);
    } finally {
      await broken.cleanup();
    }
  });

  it.each([
    ['hooks that are not an object', { hooks: [] }],
    ['an event that is not a list', { hooks: { PostToolUse: 'x' } }],
    ['the JSON literal null', null],
  ])('refuses settings with %s before touching .gitignore', async (_label, value) => {
    await write(PERSONAL_SETTINGS, value);
    await expect(checkClaudeHooks(repo.path, PERSONAL_SETTINGS)).rejects.toThrow(PERSONAL_SETTINGS);
    await expect(installClaudeHooks(repo.path, PERSONAL_SETTINGS)).rejects.toThrow(PERSONAL_SETTINGS);
    expect(await exists('.gitignore')).toBe(false);
  });

  it('refuses a .claude folder that is a symlink', async () => {
    const elsewhere = await createGitRepo();
    try {
      await symlink(elsewhere.path, join(repo.path, '.claude'));
      await expect(installClaudeHooks(repo.path, SHARED_SETTINGS)).rejects.toThrow(/symlink/);
      expect(await readFile(join(elsewhere.path, 'settings.json')).then(() => true, () => false)).toBe(false);
    } finally {
      await elsewhere.cleanup();
    }
  });

  it('refuses a settings file that is a symlink', async () => {
    await mkdir(join(repo.path, '.claude'));
    await writeFile(join(repo.path, 'mine.json'), '{}\n');
    await symlink(join(repo.path, 'mine.json'), join(repo.path, SHARED_SETTINGS));
    await expect(installClaudeHooks(repo.path, SHARED_SETTINGS)).rejects.toThrow(/symlink/);
    expect(await readFile(join(repo.path, 'mine.json'), 'utf8')).toBe('{}\n');
  });

  it('fails when a .gitignore rule still re-includes the personal file', async () => {
    await writeFile(join(repo.path, '.gitignore'), `${PERSONAL_SETTINGS}\n!${PERSONAL_SETTINGS}\n`);
    await expect(installClaudeHooks(repo.path, PERSONAL_SETTINGS)).rejects.toThrow(/still not ignored/);
    expect(await exists(PERSONAL_SETTINGS)).toBe(false);
  });
});

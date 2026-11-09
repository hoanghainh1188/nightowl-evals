import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDoctorCommand, type DoctorDeps } from '../../src/commands/doctor.js';
import { HOOK_COMMAND_LINE } from '../../src/setup/claude-settings.js';
import { CURRENT_SCHEMA_VERSION } from '../../src/storage/migrations.js';
import { DATA_DIR, DB_FILE, openStore, type Store } from '../../src/storage/store.js';
import { createFakeIo } from '../helpers/fake-io.js';
import { createFakeRepo, createTempDir, type TempDir, writeFiles } from '../helpers/temp-repo.js';

describe('nightowl doctor', () => {
  let repo: TempDir;

  beforeEach(async () => {
    repo = await createFakeRepo();
  });

  afterEach(async () => {
    await repo.cleanup();
  });

  const validSettings = {
    hooks: {
      PostToolUse: [
        {
          matcher: 'Edit|Write|MultiEdit',
          hooks: [
            {
              type: 'command',
              command: HOOK_COMMAND_LINE,
              timeout: 5,
            },
          ],
        },
      ],
    },
  };

  function createTestDeps(overrides: Partial<DoctorDeps> = {}): DoctorDeps {
    return {
      cwd: () => repo.path,
      nodeVersion: () => '22.13.0',
      isOnPath: (cmd) => cmd === 'nightowl' || cmd === 'claude',
      loadSqlite: async () => ({}),
      runGit: async (args) => {
        if (args[0] === '--version') return Buffer.from('git version 2.45.0\n');
        return Buffer.from('');
      },
      findProjectRoot: () => repo.path,
      readSettings: async (_root, file) => {
        if (file === '.claude/settings.local.json') {
          return { path: `${repo.path}/${file}`, exists: true, value: validSettings };
        }
        return { path: `${repo.path}/${file}`, exists: false, value: {} };
      },
      readTextIfExists: async (path) => {
        if (path.includes('pre-commit')) return '#!/bin/sh\nnightowl precommit\n';
        if (path.includes('post-commit')) return '#!/bin/sh\nnightowl postcommit\n';
        if (path.includes('.gitignore')) return '.nightowl/\n.claude/settings.local.json\n';
        return null;
      },
      openStore: async () => {
        return {
          pragma: (name: string) => (name === 'integrity_check' ? 'ok' : CURRENT_SCHEMA_VERSION),
          countFailures: () => ({ total: 0, byCategory: {}, byModule: {} } as any),
          listEvents: () => [],
          close: () => {},
        } as unknown as Store;
      },
      ...overrides,
    };
  }

  async function runDoctor(args: readonly string[] = [], deps: DoctorDeps = createTestDeps()) {
    const fake = createFakeIo();
    const cmd = createDoctorCommand(deps);
    const code = await cmd.run(args, fake.io);
    return { code, out: fake.out(), err: fake.err() };
  }

  it('prints help text with --help', async () => {
    const fake = createFakeIo();
    const cmd = createDoctorCommand(createTestDeps());
    expect(cmd.help).toContain('Usage: nightowl doctor');
    expect(cmd.help).toContain('--strict');
  });

  it('rejects invalid arguments with exit code 1', async () => {
    const { code, err } = await runDoctor(['--unknown-flag']);
    expect(code).toBe(1);
    expect(err.toLowerCase()).toContain("unknown option '--unknown-flag'");
    expect(err).toContain("Run 'nightowl doctor --help'");
  });

  it('passes all checks in a fully healthy environment', async () => {
    // Write fake db file
    await writeFiles(repo.path, {
      [`${DATA_DIR}/${DB_FILE}`]: 'sqlite database',
    });

    const { code, out, err } = await runDoctor();
    expect(code).toBe(0);
    expect(err).toBe('');
    expect(out).toContain('Node.js & Runtime');
    expect(out).toContain('✓ Node.js v22.13.0 (>= 22.13.0)');
    expect(out).toContain('✓ node:sqlite is operational');
    expect(out).toContain('✓ nightowl command is available on PATH');
    expect(out).toContain('Git Repository');
    expect(out).toContain('✓ git version 2.45.0');
    expect(out).toContain(`✓ Git repository found at ${repo.path}`);
    expect(out).toContain('Claude Code Integration');
    expect(out).toContain('✓ claude command is available on PATH');
    expect(out).toContain('✓ Hooks configured in .claude/settings.local.json');
    expect(out).toContain('Git Hooks');
    expect(out).toContain("✓ pre-commit runs 'nightowl precommit'");
    expect(out).toContain("✓ post-commit runs 'nightowl postcommit'");
    expect(out).toContain('✓ .nightowl/ is ignored in .gitignore');
    expect(out).toContain('NightOwl Database');
    expect(out).toContain('✓ Database integrity check passed (ok)');
    expect(out).toContain(`✓ Schema version is ${CURRENT_SCHEMA_VERSION} (up to date)`);
    expect(out).toContain('Result:');
    expect(out).toContain('0 failures');
  });

  it('warns when uninitialized but exits 0 without --strict', async () => {
    const deps = createTestDeps({
      readSettings: async () => ({ path: '', exists: false, value: {} }),
      readTextIfExists: async () => null,
      isOnPath: () => false,
    });

    const { code, out } = await runDoctor([], deps);
    expect(code).toBe(0);
    expect(out).toContain('! nightowl command is not on PATH');
    expect(out).toContain('! claude command is not on PATH');
    expect(out).toContain('! No NightOwl hooks found in Claude Code settings');
    expect(out).toContain("! pre-commit does not call 'nightowl precommit'");
    expect(out).toContain('! Database file .nightowl/nightowl.db does not exist yet');
    expect(out).toContain('Suggestions & Remedies:');
    expect(out).toContain("Run 'nightowl init'");
  });

  it('exits 1 when uninitialized if --strict is passed', async () => {
    const deps = createTestDeps({
      readSettings: async () => ({ path: '', exists: false, value: {} }),
      readTextIfExists: async () => null,
    });

    const { code, out } = await runDoctor(['--strict'], deps);
    expect(code).toBe(1);
    expect(out).toContain('Suggestions & Remedies:');
  });

  it('fails when Node.js version is unsupported (< 22.13)', async () => {
    const deps = createTestDeps({
      nodeVersion: () => '20.18.0',
    });

    const { code, out } = await runDoctor([], deps);
    expect(code).toBe(1);
    expect(out).toContain('✗ Node.js v20.18.0 is unsupported (>= 22.13.0 required)');
    expect(out).toContain('Upgrade Node.js to version 22.13.0 or higher');
  });

  it('fails when node:sqlite cannot be loaded', async () => {
    const deps = createTestDeps({
      loadSqlite: async () => {
        throw new Error('SQLite not supported in this binary');
      },
    });

    const { code, out } = await runDoctor([], deps);
    expect(code).toBe(1);
    expect(out).toContain('✗ node:sqlite failed to load');
  });

  it('fails when git is not accessible', async () => {
    const deps = createTestDeps({
      runGit: async () => {
        throw new Error('git command not found');
      },
    });

    const { code, out } = await runDoctor([], deps);
    expect(code).toBe(1);
    expect(out).toContain('✗ Git is not accessible');
  });

  it('fails when run outside of a git repository', async () => {
    const deps = createTestDeps({
      findProjectRoot: () => null,
    });

    const { code, out } = await runDoctor([], deps);
    expect(code).toBe(1);
    expect(out).toContain('✗ No git repository found');
  });

  it('detects hooks in shared settings file .claude/settings.json', async () => {
    const deps = createTestDeps({
      readSettings: async (_root, file) => {
        if (file === '.claude/settings.json') {
          return {
            path: `${repo.path}/${file}`,
            exists: true,
            value: validSettings,
          };
        }
        return { path: `${repo.path}/${file}`, exists: false, value: {} };
      },
    });

    const { out } = await runDoctor([], deps);
    expect(out).toContain('✓ Hooks configured in .claude/settings.json');
  });

  it('warns if hooks are present in both settings files', async () => {
    const deps = createTestDeps({
      readSettings: async (_root, file) => ({
        path: `${repo.path}/${file}`,
        exists: true,
        value: validSettings,
      }),
    });

    const { out } = await runDoctor([], deps);
    expect(out).toContain('! Hooks are configured in both personal and shared settings files');
  });

  it('fails when database integrity check fails', async () => {
    await writeFiles(repo.path, {
      [`${DATA_DIR}/${DB_FILE}`]: 'corrupt db',
    });

    const deps = createTestDeps({
      openStore: async () =>
        ({
          pragma: (name: string) => (name === 'integrity_check' ? 'row 1: page 3 is corrupted' : CURRENT_SCHEMA_VERSION),
          countFailures: () => ({ total: 0 }),
          listEvents: () => [],
          close: () => {},
        }) as unknown as Store,
    });

    const { code, out } = await runDoctor([], deps);
    expect(code).toBe(1);
    expect(out).toContain('✗ Database integrity check failed');
  });

  it('warns when database schema is older than current', async () => {
    await writeFiles(repo.path, {
      [`${DATA_DIR}/${DB_FILE}`]: 'old db',
    });

    const deps = createTestDeps({
      openStore: async () =>
        ({
          pragma: (name: string) => (name === 'integrity_check' ? 'ok' : 1),
          countFailures: () => ({ total: 0 }),
          listEvents: () => [],
          close: () => {},
        }) as unknown as Store,
    });

    const { code, out } = await runDoctor([], deps);
    expect(code).toBe(0);
    expect(out).toContain(`! Schema version 1 is older than current version ${CURRENT_SCHEMA_VERSION}`);
  });

  it('fails when database schema is newer than current', async () => {
    await writeFiles(repo.path, {
      [`${DATA_DIR}/${DB_FILE}`]: 'future db',
    });

    const deps = createTestDeps({
      openStore: async () =>
        ({
          pragma: (name: string) => (name === 'integrity_check' ? 'ok' : 999),
          countFailures: () => ({ total: 0 }),
          listEvents: () => [],
          close: () => {},
        }) as unknown as Store,
    });

    const { code, out } = await runDoctor([], deps);
    expect(code).toBe(1);
    expect(out).toContain('✗ Schema version 999 is newer than supported version');
  });

  it('fails when database open throws an error', async () => {
    await writeFiles(repo.path, {
      [`${DATA_DIR}/${DB_FILE}`]: 'bad db',
    });

    const deps = createTestDeps({
      openStore: async () => {
        throw new Error('permission denied');
      },
    });

    const { code, out } = await runDoctor([], deps);
    expect(code).toBe(1);
    expect(out).toContain('✗ Failed to inspect database: permission denied');
  });

  it('verifies hooks configured in Husky (.husky/)', async () => {
    await writeFiles(repo.path, {
      '.husky/pre-commit': '#!/bin/sh\nnightowl precommit\n',
      '.husky/post-commit': '#!/bin/sh\nnightowl postcommit\n',
    });

    const deps = createTestDeps({
      readTextIfExists: async (path) => {
        if (path.includes('.husky/pre-commit')) return '#!/bin/sh\nnightowl precommit\n';
        if (path.includes('.husky/post-commit')) return '#!/bin/sh\nnightowl postcommit\n';
        if (path.includes('.gitignore')) return '.nightowl/\n';
        return null;
      },
    });

    const { out } = await runDoctor([], deps);
    expect(out).toContain('✓ pre-commit (husky) runs \'nightowl precommit\'');
    expect(out).toContain('✓ post-commit (husky) runs \'nightowl postcommit\'');
  });

  it('verifies hooks configured in Lefthook (lefthook.yml)', async () => {
    await writeFiles(repo.path, {
      'lefthook.yml': 'pre-commit:\n  commands:\n    nightowl: run: nightowl precommit\npost-commit:\n  commands:\n    nightowl: run: nightowl postcommit\n',
    });

    const deps = createTestDeps({
      readTextIfExists: async (path) => {
        if (path.includes('lefthook.yml')) {
          return 'pre-commit:\n  nightowl precommit\npost-commit:\n  nightowl postcommit\n';
        }
        if (path.includes('.gitignore')) return '.nightowl/\n';
        return null;
      },
    });

    const { out } = await runDoctor([], deps);
    expect(out).toContain('✓ pre-commit (lefthook) runs \'nightowl precommit\'');
    expect(out).toContain('✓ post-commit (lefthook) runs \'nightowl postcommit\'');
  });
});

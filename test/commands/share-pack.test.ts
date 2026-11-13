import { gunzipSync } from 'node:zlib';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSharePackCommand } from '../../src/commands/share-pack.js';
import { COMMAND_FLAGS } from '../../src/completion/catalog.js';
import { commands } from '../../src/commands/index.js';
import { createFakeIo } from '../helpers/fake-io.js';
import { seed } from '../helpers/seed-failures.js';
import { createFakeRepo, type TempDir } from '../helpers/temp-repo.js';

describe('nightowl share-pack', () => {
  let repo: TempDir;
  beforeEach(async () => {
    repo = await createFakeRepo();
  });
  afterEach(() => repo.cleanup());

  async function run(args: readonly string[] = []) {
    const fake = createFakeIo();
    const code = await createSharePackCommand({
      cwd: () => repo.path,
      now: () => new Date('2026-11-12T12:00:00.000Z'),
    }).run(args, fake.io);
    return { code, out: fake.out(), err: fake.err() };
  }

  it('is registered and listed in completion', () => {
    expect(commands.some((c) => c.name === 'share-pack')).toBe(true);
    expect(COMMAND_FLAGS['share-pack']).toContain('--archive');
    expect(COMMAND_FLAGS['share-pack']).toContain('--no-redact-paths');
  });

  it('documents privacy/offline share in --help', () => {
    const help = createSharePackCommand().help;
    expect(help).toMatch(/redact|privacy|network|offline/i);
    expect(help).toContain('--archive');
    expect(help).toContain('--no-redact-paths');
  });

  it('errors when NightOwl is not initialized', async () => {
    const result = await run();
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/init/i);
  });

  it('writes report.md, digest.md, and manifest with redaction by default', async () => {
    await seed(repo.path, [
      {
        filePath: 'src/hooks/git/run.ts',
        category: 'logic',
        status: 'flagged',
        createdAt: '2026-11-10T00:00:00.000Z',
      },
    ]);
    const outDir = join(repo.path, 'pack-out');
    const result = await run(['--since', '7d', '-o', outDir]);
    expect(result.code).toBe(0);
    expect(result.err).toBe('');
    expect(result.out).toContain(outDir);

    const files = await readdir(outDir);
    expect(files.sort()).toEqual(['digest.md', 'manifest.json', 'report.md']);

    const report = await readFile(join(outDir, 'report.md'), 'utf8');
    expect(report).toContain('NightOwl report');
    // depth-2 module src/hooks coarsens to src/**/hooks when redacting module labels with >2 segments;
    // src/hooks is exactly 2 segments so stays; use path that coarsens: packages already...
    // samplePaths aren't in plain report without clusters — module for src/hooks/git/run at depth 2 is src/hooks (2 segs).
    // Use deeper path check via manifest redactPaths flag instead.
    const manifest = JSON.parse(await readFile(join(outDir, 'manifest.json'), 'utf8'));
    expect(manifest.redactPaths).toBe(true);
    expect(manifest.files).toEqual(['report.md', 'digest.md', 'manifest.json']);
    expect(manifest.note).toMatch(/Local-only/);
    expect(manifest.nightowlVersion).toMatch(/^\d+\.\d+\.\d+/);

    const digest = await readFile(join(outDir, 'digest.md'), 'utf8');
    expect(digest).toContain('NightOwl digest');
  });

  it('coarsens deep module paths when redaction is on', async () => {
    await seed(repo.path, [
      {
        filePath: 'src/a/b/c/d.ts',
        category: 'logic',
        createdAt: '2026-11-10T00:00:00.000Z',
      },
    ]);
    // depth 4 → module src/a/b/c → coarsen to src/**/c
    const outDir = join(repo.path, 'pack-redact');
    const result = await run(['--since', '7d', '--depth', '4', '-o', outDir]);
    expect(result.code).toBe(0);
    const report = await readFile(join(outDir, 'report.md'), 'utf8');
    expect(report).toContain('src/**/c');
    expect(report).not.toContain('src/a/b/c');
  });

  it('keeps full paths with --no-redact-paths', async () => {
    await seed(repo.path, [
      {
        filePath: 'src/a/b/c/d.ts',
        category: 'logic',
        createdAt: '2026-11-10T00:00:00.000Z',
      },
    ]);
    const outDir = join(repo.path, 'pack-full');
    const result = await run(['--since', '7d', '--depth', '4', '--no-redact-paths', '-o', outDir]);
    expect(result.code).toBe(0);
    const report = await readFile(join(outDir, 'report.md'), 'utf8');
    expect(report).toContain('src/a/b/c');
    const manifest = JSON.parse(await readFile(join(outDir, 'manifest.json'), 'utf8'));
    expect(manifest.redactPaths).toBe(false);
  });

  it('writes a local tar.gz when --archive is set', async () => {
    await seed(repo.path, [{ filePath: 'src/a.ts', createdAt: '2026-11-10T00:00:00.000Z' }]);
    const outDir = join(repo.path, 'pack-arch');
    await mkdir(outDir, { recursive: true });
    const result = await run(['--since', '7d', '-o', outDir, '--archive']);
    expect(result.code).toBe(0);
    expect(result.out).toMatch(/\.tar\.gz/);
    const gz = await readFile(`${outDir}.tar.gz`);
    const tar = gunzipSync(gz);
    expect(tar.includes(Buffer.from('report.md'))).toBe(true);
    expect(tar.includes(Buffer.from('manifest.json'))).toBe(true);
  });

  it('defaults under .nightowl/share/<stamp>/', async () => {
    await seed(repo.path, [{ filePath: 'src/a.ts', createdAt: '2026-11-10T00:00:00.000Z' }]);
    const result = await run(['--since', '7d']);
    expect(result.code).toBe(0);
    expect(result.out).toMatch(/\.nightowl\/share\//);
  });
});

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addGitignoreEntry, ensureGitignoreEntry } from '../../src/setup/gitignore.js';
import { createFakeRepo, type TempDir } from '../helpers/temp-repo.js';

describe('addGitignoreEntry', () => {
  it('creates content when there is no file', () => {
    expect(addGitignoreEntry(null, '.nightowl/')).toBe('.nightowl/\n');
  });

  it('appends after existing lines, adding the missing final newline', () => {
    expect(addGitignoreEntry('node_modules/', '.nightowl/')).toBe('node_modules/\n.nightowl/\n');
    expect(addGitignoreEntry('node_modules/\n', '.nightowl/')).toBe('node_modules/\n.nightowl/\n');
  });

  it.each(['.nightowl/', '.nightowl', '/.nightowl/', '  .nightowl/  '])('returns null when %j is already ignored', (line) => {
    expect(addGitignoreEntry(`dist/\n${line}\n`, '.nightowl/')).toBeNull();
  });

  it('does not treat a negated or commented line as present', () => {
    expect(addGitignoreEntry('# .nightowl/\n', '.nightowl/')).toBe('# .nightowl/\n.nightowl/\n');
    expect(addGitignoreEntry('!.nightowl/\n', '.nightowl/')).toBe('!.nightowl/\n.nightowl/\n');
  });
});

describe('ensureGitignoreEntry', () => {
  let repo: TempDir;
  beforeEach(async () => {
    repo = await createFakeRepo();
  });
  afterEach(() => repo.cleanup());

  it('reports created, then unchanged', async () => {
    expect(await ensureGitignoreEntry(repo.path)).toBe('created');
    expect(await readFile(join(repo.path, '.gitignore'), 'utf8')).toBe('.nightowl/\n');
    expect(await ensureGitignoreEntry(repo.path)).toBe('unchanged');
  });

  it('reports updated and keeps other lines', async () => {
    await writeFile(join(repo.path, '.gitignore'), 'node_modules/\n');
    expect(await ensureGitignoreEntry(repo.path)).toBe('updated');
    expect(await readFile(join(repo.path, '.gitignore'), 'utf8')).toBe('node_modules/\n.nightowl/\n');
  });
});

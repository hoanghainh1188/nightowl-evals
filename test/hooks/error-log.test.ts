import { readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appendErrorLog, MAX_ERROR_LOG_BYTES } from '../../src/hooks/error-log.js';
import { createFakeRepo, type TempDir, writeFiles } from '../helpers/temp-repo.js';

describe('appendErrorLog', () => {
  let repo: TempDir;
  const file = () => join(repo.path, '.nightowl', 'nightowl.log');
  beforeEach(async () => {
    repo = await createFakeRepo();
  });
  afterEach(() => repo.cleanup());

  it('appends one timestamped line per error', async () => {
    await appendErrorLog(repo.path, 'log', 'invalid payload');
    await appendErrorLog(repo.path, 'log', Object.assign(new Error('locked'), { code: 'ERR_SQLITE_ERROR' }));
    const lines = (await readFile(file(), 'utf8')).trimEnd().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^\d{4}-\d{2}-\d{2}T\S+Z log invalid payload$/);
    expect(lines[1]).toMatch(/ log Error ERR_SQLITE_ERROR: locked$/);
  });

  it('hides the home directory and caps the message length', async () => {
    const { homedir } = await import('node:os');
    await appendErrorLog(repo.path, 'log', new Error(`cannot read ${homedir()}/secret ${'x'.repeat(1000)}`));
    const line = await readFile(file(), 'utf8');
    expect(line).not.toContain(homedir());
    expect(line).toContain('~/secret');
    expect(line.length).toBeLessThan(400);
  });

  it('does not follow a symlinked .nightowl', async () => {
    const { createTempDir } = await import('../helpers/temp-repo.js');
    const { symlink, readdir } = await import('node:fs/promises');
    const outside = await createTempDir();
    try {
      await symlink(outside.path, join(repo.path, '.nightowl'));
      await appendErrorLog(repo.path, 'log', 'x');
      expect(await readdir(outside.path)).toEqual([]);
    } finally {
      await outside.cleanup();
    }
  });

  it('keeps each line on one line', async () => {
    await appendErrorLog(repo.path, 'log', 'two\nlines');
    expect((await readFile(file(), 'utf8')).trimEnd().split('\n')).toHaveLength(1);
  });

  it('starts over once the file passes the size limit', async () => {
    await writeFiles(repo.path, { '.nightowl/nightowl.log': 'x'.repeat(MAX_ERROR_LOG_BYTES + 1) });
    await appendErrorLog(repo.path, 'log', 'fresh');
    expect((await stat(file())).size).toBeLessThan(200);
  });

  it('never throws, even when it cannot write', async () => {
    await writeFile(join(repo.path, '.nightowl'), 'not a directory');
    await expect(appendErrorLog(repo.path, 'log', 'x')).resolves.toBeUndefined();
  });
});

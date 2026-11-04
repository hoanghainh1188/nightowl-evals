import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exportCommand } from '../../src/commands/export.js';
import { initCommand } from '../../src/commands/init.js';
import { reportCommand } from '../../src/commands/report.js';
import { createFakeIo } from '../helpers/fake-io.js';

describe.each([initCommand, reportCommand, exportCommand])('$name (not implemented)', (command) => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'nightowl-'));
    vi.spyOn(process, 'cwd').mockReturnValue(dir);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(dir, { recursive: true, force: true });
  });

  it('reports it is not implemented on stderr and exits 0', async () => {
    const fake = createFakeIo();
    const code = await command.run([], fake.io);
    expect(code).toBe(0);
    expect(fake.out()).toBe('');
    expect(fake.err()).toBe(`nightowl ${command.name}: not implemented yet\n`);
  });

  it('does not create any file', async () => {
    await command.run([], createFakeIo().io);
    expect(await readdir(dir)).toEqual([]);
  });
});

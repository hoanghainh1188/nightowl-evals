import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCustomerReportCommand } from '../../src/commands/customer-report.js';
import { createDashboardCommand } from '../../src/commands/dashboard.js';
import { createDigestCommand } from '../../src/commands/digest.js';
import { createFakeIo } from '../helpers/fake-io.js';
import { seed } from '../helpers/seed-failures.js';
import { createFakeRepo, type TempDir } from '../helpers/temp-repo.js';

describe('share-out --redact-paths', () => {
  let repo: TempDir;
  beforeEach(async () => {
    repo = await createFakeRepo();
    await seed(repo.path, [
      {
        filePath: 'src/hooks/git/run.ts',
        category: 'logic',
        status: 'flagged',
        createdAt: '2026-11-10T00:00:00.000Z',
      },
    ]);
  });
  afterEach(() => repo.cleanup());

  it('coarsens modules on customer-report and dashboard', async () => {
    const customer = createFakeIo();
    expect(
      await createCustomerReportCommand({
        cwd: () => repo.path,
        now: () => new Date('2026-11-12T12:00:00.000Z'),
      }).run(['--redact-paths', '--lang', 'vi', '--depth', '3'], customer.io),
    ).toBe(0);
    expect(customer.out()).toContain('src/**/git');
    expect(customer.out()).not.toContain('src/hooks/git');

    const dash = createFakeIo();
    expect(
      await createDashboardCommand({
        cwd: () => repo.path,
        now: () => new Date('2026-11-12T12:00:00.000Z'),
      }).run(['--redact-paths', '--depth', '3'], dash.io),
    ).toBe(0);
    const html = await readFile(join(repo.path, '.nightowl/dashboard.html'), 'utf8');
    expect(html).toContain('src/**/git');
    expect(html).not.toContain('src/hooks/git');
  });

  it('digest accepts --redact-paths', async () => {
    const fake = createFakeIo();
    expect(
      await createDigestCommand({
        cwd: () => repo.path,
        now: () => new Date('2026-11-12T12:00:00.000Z'),
      }).run(['--redact-paths', '--since', '7d'], fake.io),
    ).toBe(0);
    expect(fake.out()).toContain('New failures');
  });
});

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createIngestCiCommand } from '../../src/commands/ingest-ci.js';
import { openStore } from '../../src/storage/store.js';
import { createFakeIo } from '../helpers/fake-io.js';
import { createFakeRepo, type TempDir } from '../helpers/temp-repo.js';

const JUNIT = `<?xml version="1.0"?>
<testsuite name="s" tests="1" failures="1">
  <testcase classname="C" name="n" file="src/a.ts">
    <failure message="nope">fail</failure>
  </testcase>
</testsuite>
`;

describe('nightowl ingest-ci', () => {
  let repo: TempDir;
  beforeEach(async () => {
    repo = await createFakeRepo();
  });
  afterEach(() => repo.cleanup());

  async function run(args: readonly string[]) {
    const fake = createFakeIo();
    const code = await createIngestCiCommand({ cwd: () => repo.path }).run(args, fake.io);
    return { code, out: fake.out(), err: fake.err() };
  }

  it('errors when NightOwl is not initialized', async () => {
    const result = await run(['--file', 'x.xml']);
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/init/i);
  });

  it('ingests JUnit fails idempotently without creating failures', async () => {
    (await openStore({ cwd: repo.path })).close();
    const file = join(repo.path, 'junit.xml');
    await writeFile(file, JUNIT, 'utf8');

    expect(await run(['--file', file])).toMatchObject({ code: 0 });
    expect((await run(['--file', file])).out).toMatch(/0 new.*1 duplicate/i);

    const store = await openStore({ cwd: repo.path, readOnly: true });
    try {
      expect(store.listEvents({ kinds: ['ci-fail'] })).toHaveLength(1);
      expect(store.countFailures().total).toBe(0);
      expect(store.listEvents({ kinds: ['ci-fail'] })[0]).toMatchObject({
        source: 'ci',
        filePath: 'src/a.ts',
        payload: expect.objectContaining({ test_name: 'n', message: expect.stringContaining('nope') }),
      });
    } finally {
      store.close();
    }
  });

  it('links open agent edits when present', async () => {
    const store = await openStore({ cwd: repo.path });
    store.insertEvent({
      source: 'agent-hook',
      kind: 'edit',
      filePath: 'src/a.ts',
      agent: 'claude-code',
      payload: { snapshot: 'x' },
    });
    store.close();
    const file = join(repo.path, 'out', 'junit.xml');
    await mkdir(join(repo.path, 'out'), { recursive: true });
    await writeFile(file, JUNIT, 'utf8');
    expect(await run(['--file', file])).toMatchObject({ code: 0 });
    const check = await openStore({ cwd: repo.path, readOnly: true });
    try {
      const event = check.listEvents({ kinds: ['ci-fail'] })[0]!;
      expect(event.agent).toBe('claude-code');
      expect((event.payload as { related_event_id: number }).related_event_id).toBeGreaterThan(0);
    } finally {
      check.close();
    }
  });
});

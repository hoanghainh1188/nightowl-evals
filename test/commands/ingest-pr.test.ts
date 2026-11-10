import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createIngestPrCommand } from '../../src/commands/ingest-pr.js';
import { openStore } from '../../src/storage/store.js';
import { createFakeIo } from '../helpers/fake-io.js';
import { createFakeRepo, type TempDir } from '../helpers/temp-repo.js';

describe('nightowl ingest-pr', () => {
  let repo: TempDir;
  beforeEach(async () => {
    repo = await createFakeRepo();
  });
  afterEach(() => repo.cleanup());

  async function run(
    args: readonly string[],
    extras: { env?: NodeJS.ProcessEnv; fetch?: typeof fetch } = {},
  ) {
    const fake = createFakeIo();
    const deps =
      extras.fetch === undefined
        ? { cwd: () => repo.path, env: () => extras.env ?? {} }
        : { cwd: () => repo.path, env: () => extras.env ?? {}, fetch: extras.fetch };
    const code = await createIngestPrCommand(deps).run(args, fake.io);
    return { code, out: fake.out(), err: fake.err() };
  }

  it('errors when not initialized', async () => {
    const result = await run(['--file', 'c.json']);
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/init/i);
  });

  it('ingests local JSON without calling fetch', async () => {
    (await openStore({ cwd: repo.path })).close();
    const file = join(repo.path, 'comments.json');
    await writeFile(
      file,
      JSON.stringify([{ id: '1', path: 'src/a.ts', body: 'please fix', line: 2 }]),
      'utf8',
    );
    const fetchMock = vi.fn();
    const result = await run(['--file', file], { fetch: fetchMock as unknown as typeof fetch });
    expect(result.code).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
    const store = await openStore({ cwd: repo.path, readOnly: true });
    try {
      expect(store.listEvents({ kinds: ['pr-review'] })).toHaveLength(1);
      expect(store.countFailures().total).toBe(0);
    } finally {
      store.close();
    }
  });

  it('requires token when --github is set', async () => {
    (await openStore({ cwd: repo.path })).close();
    const result = await run(['--github', '--pr', '3'], { env: { GITHUB_REPOSITORY: 'o/r' } });
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/GITHUB_TOKEN/);
  });

  it('fetches review comments when --github and token are set', async () => {
    (await openStore({ cwd: repo.path })).close();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => [{ id: 42, path: 'src/b.ts', body: 'from api', user: { login: 'bot' } }],
    }));
    const result = await run(['--github', '--pr', '7'], {
      env: { GITHUB_TOKEN: 't', GITHUB_REPOSITORY: 'acme/app' },
      fetch: fetchMock as unknown as typeof fetch,
    });
    expect(result.code).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls.at(0)?.at(0))).toContain('/repos/acme/app/pulls/7/comments');
    const store = await openStore({ cwd: repo.path, readOnly: true });
    try {
      const event = store.listEvents({ kinds: ['pr-review'] })[0]!;
      expect(event.payload).toMatchObject({ comment_id: '42', body: 'from api', user: 'bot', pr: '7' });
    } finally {
      store.close();
    }
  });
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLogCommand } from '../../src/commands/log.js';
import { createPostcommitCommand } from '../../src/commands/postcommit.js';
import { createPrecommitCommand } from '../../src/commands/precommit.js';
import { createFakeIo } from '../helpers/fake-io.js';
import { createFakeRepo, type TempDir } from '../helpers/temp-repo.js';

// Hooks must never block Claude Code or git, so stray arguments change nothing.
describe('hook commands with unknown arguments', () => {
  let repo: TempDir;
  beforeEach(async () => {
    repo = await createFakeRepo();
  });
  afterEach(() => repo.cleanup());

  const create = {
    log: () => createLogCommand({ cwd: () => repo.path, record: async () => {} }),
    precommit: () => createPrecommitCommand({ cwd: () => repo.path }),
    postcommit: () => createPostcommitCommand({ cwd: () => repo.path }),
  };

  it.each(['log', 'precommit', 'postcommit'] as const)('%s exits 0 and prints nothing', async (name) => {
    const fake = createFakeIo({ stdin: '' });
    expect(await create[name]().run(['--unknown', 'extra'], fake.io)).toBe(0);
    expect(fake.out()).toBe('');
    expect(fake.err()).toBe('');
  });
});

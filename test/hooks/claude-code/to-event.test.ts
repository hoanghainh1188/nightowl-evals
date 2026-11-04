import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_PROMPT_BYTES,
  MAX_SNAPSHOT_BYTES,
  toEvent,
} from '../../../src/hooks/claude-code/to-event.js';
import { parseHookPayload, type HookPayload } from '../../../src/hooks/claude-code/payload.js';
import { hookFixture, type FixtureName } from '../../helpers/fixtures.js';
import { createFakeRepo, createTempDir, type TempDir, writeFiles } from '../../helpers/temp-repo.js';

function payload(name: FixtureName, root: string): HookPayload {
  const parsed = parseHookPayload(hookFixture(name, root));
  if (parsed === null) throw new Error(`fixture ${name} did not parse`);
  return parsed;
}

function editPayload(root: string, filePath: string): HookPayload {
  return { event: 'PostToolUse', sessionId: 's1', cwd: root, toolName: 'Write', toolInput: { file_path: filePath, content: 'x' } };
}

describe('toEvent', () => {
  let repo: TempDir;
  beforeEach(async () => {
    repo = await createFakeRepo();
    await writeFiles(repo.path, { 'src/a.ts': 'export const a = 2;\n' });
  });
  afterEach(() => repo.cleanup());

  it('turns a prompt into a prompt event', async () => {
    expect(await toEvent(payload('user-prompt-submit', repo.path), repo.path)).toEqual({
      source: 'claude-code',
      kind: 'prompt',
      sessionId: 's1',
      filePath: null,
      payload: { prompt: 'thêm validate email cho form đăng ký', truncated: false },
    });
  });

  it('turns an Edit into an edit event with the change and a file snapshot', async () => {
    expect(await toEvent(payload('post-tool-use-edit', repo.path), repo.path)).toEqual({
      source: 'claude-code',
      kind: 'edit',
      sessionId: 's1',
      filePath: 'src/a.ts',
      payload: {
        tool: 'Edit',
        input: { old_string: 'return true;', new_string: 'return EMAIL.test(value);', replace_all: false },
        snapshot: 'export const a = 2;\n',
        snapshot_skipped: null,
      },
    });
  });

  it('keeps only the length of Write content, since the snapshot holds it', async () => {
    const event = await toEvent(payload('post-tool-use-write', repo.path), repo.path);
    expect(event?.payload).toMatchObject({ tool: 'Write', input: { content_length: 20 } });
  });

  it('resolves a relative MultiEdit path against cwd', async () => {
    const event = await toEvent(payload('post-tool-use-multiedit', repo.path), repo.path);
    expect(event).toMatchObject({ filePath: 'src/a.ts', payload: { tool: 'MultiEdit', input: { edits: [{ old_string: 'a', new_string: 'b' }] } } });
  });

  it('ignores other tools', async () => {
    expect(await toEvent(payload('post-tool-use-bash', repo.path), repo.path)).toBeNull();
  });

  it('ignores files outside the project, in .git/ or .nightowl/, or reached through a symlink', async () => {
    const outside = await createTempDir();
    try {
      await writeFiles(outside.path, { 'secret.txt': 'x' });
      await writeFiles(repo.path, { '.git/config': 'x', '.nightowl/nightowl.log': 'x' });
      await symlink(outside.path, join(repo.path, 'link'));
      for (const file of [
        join(outside.path, 'secret.txt'),
        join(repo.path, '.git/config'),
        join(repo.path, '.nightowl/nightowl.log'),
        join(repo.path, 'link/secret.txt'),
        join(repo.path, '../escape.txt'),
      ]) {
        expect(await toEvent(editPayload(repo.path, file), repo.path)).toBeNull();
      }
    } finally {
      await outside.cleanup();
    }
  });

  it('truncates long prompts', async () => {
    const long: HookPayload = { event: 'UserPromptSubmit', sessionId: 's', cwd: repo.path, prompt: 'x'.repeat(MAX_PROMPT_BYTES + 10) };
    const event = await toEvent(long, repo.path);
    expect(event?.payload).toMatchObject({ truncated: true });
    expect(Buffer.byteLength((event?.payload as { prompt: string }).prompt)).toBeLessThanOrEqual(MAX_PROMPT_BYTES);
  });

  it('skips the snapshot of a very large file but keeps the event', async () => {
    await writeFile(join(repo.path, 'big.txt'), 'x'.repeat(MAX_SNAPSHOT_BYTES + 1));
    const event = await toEvent(editPayload(repo.path, join(repo.path, 'big.txt')), repo.path);
    expect(event?.payload).toMatchObject({ snapshot: null, snapshot_skipped: 'too_large' });
  });

  it('marks a snapshot it could not read', async () => {
    const event = await toEvent(editPayload(repo.path, join(repo.path, 'gone.ts')), repo.path);
    expect(event?.payload).toMatchObject({ snapshot: null, snapshot_skipped: 'unreadable' });
  });

  it('keeps the event when the file is a directory', async () => {
    await mkdir(join(repo.path, 'dir'));
    const event = await toEvent(editPayload(repo.path, join(repo.path, 'dir')), repo.path);
    expect(event?.payload).toMatchObject({ snapshot_skipped: 'unreadable' });
  });
});

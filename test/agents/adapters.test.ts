import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { detectAndParse } from '../../src/agents/detect.js';
import { parseCursor } from '../../src/agents/cursor.js';
import { parseGenericAgent } from '../../src/agents/generic.js';
import { createFakeRepo, type TempDir, writeFiles } from '../helpers/temp-repo.js';

describe('agent adapters', () => {
  let repo: TempDir;
  beforeEach(async () => {
    repo = await createFakeRepo();
    await writeFiles(repo.path, { 'src/a.ts': 'export const a = 1;\n' });
  });
  afterEach(() => repo.cleanup());

  it('parses Cursor beforeSubmitPrompt and afterFileEdit', async () => {
    const prompt = await parseCursor(
      JSON.stringify({
        hook_event_name: 'beforeSubmitPrompt',
        conversation_id: 'c1',
        cwd: repo.path,
        prompt: 'fix the bug',
      }),
      repo.path,
    );
    expect(prompt).toMatchObject({ agent: 'cursor', event: { kind: 'prompt', sessionId: 'c1' } });

    const edit = await parseCursor(
      JSON.stringify({
        hook_event_name: 'afterFileEdit',
        conversation_id: 'c1',
        cwd: repo.path,
        file_path: 'src/a.ts',
      }),
      repo.path,
    );
    expect(edit).toMatchObject({
      agent: 'cursor',
      event: { kind: 'edit', filePath: 'src/a.ts', agent: 'cursor', payload: expect.objectContaining({ snapshot: 'export const a = 1;\n' }) },
    });
  });

  it.each([
    ['windsurf', 'post_file_edit'],
    ['cline', 'file_edited'],
    ['roo', 'file_written'],
    ['copilot-workspace', 'file_changed'],
    ['aider', 'file_update'],
  ] as const)('normalizes %s edit fixture', async (agent, eventName) => {
    const parsed = await parseGenericAgent(
      JSON.stringify({
        hook_event_name: eventName,
        session_id: 's1',
        cwd: repo.path,
        file_path: 'src/a.ts',
      }),
      repo.path,
      agent,
    );
    expect(parsed).toMatchObject({ agent, event: { kind: 'edit', filePath: 'src/a.ts', agent } });
  });

  it('rejects an explicit unknown agent id', async () => {
    expect(await detectAndParse(JSON.stringify({ agent: 'unknown-bot', prompt: 'x', cwd: repo.path }), repo.path)).toBeNull();
    expect(await detectAndParse('{"prompt":"x"}', repo.path, 'unknown-bot')).toBeNull();
  });
});

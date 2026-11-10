import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { detectAndParse } from '../../src/agents/detect.js';
import { parseCursor } from '../../src/agents/cursor.js';
import { parseGenericAgent } from '../../src/agents/generic.js';
import { maturityOf } from '../../src/agents/ids.js';
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
    ['windsurf', 'post_file_edit', 'pre_user_prompt'],
    ['cline', 'file_edited', 'task_prompt'],
    ['roo', 'file_written', 'UserPromptSubmit'],
  ] as const)('normalizes %s edit and prompt fixtures (best-effort)', async (agent, editEvent, promptEvent) => {
    expect(maturityOf(agent)).toBe('best-effort');
    const edit = await parseGenericAgent(
      JSON.stringify({
        hook_event_name: editEvent,
        session_id: 's1',
        cwd: repo.path,
        file_path: 'src/a.ts',
      }),
      repo.path,
      agent,
    );
    expect(edit).toMatchObject({ agent, event: { kind: 'edit', filePath: 'src/a.ts', agent } });

    const prompt = await parseGenericAgent(
      JSON.stringify({
        hook_event_name: promptEvent,
        session_id: 's1',
        cwd: repo.path,
        prompt: 'hello',
      }),
      repo.path,
      agent,
    );
    expect(prompt).toMatchObject({ agent, event: { kind: 'prompt', agent } });
  });

  it.each([
    ['copilot-workspace', 'file_changed'],
    ['aider', 'file_update'],
  ] as const)('manual %s parses only when forced or explicit agent field', async (agent, eventName) => {
    expect(maturityOf(agent)).toBe('manual');
    const payload = JSON.stringify({
      hook_event_name: eventName,
      session_id: 's1',
      cwd: repo.path,
      file_path: 'src/a.ts',
    });
    expect(await detectAndParse(payload, repo.path)).toBeNull();

    const forced = await detectAndParse(payload, repo.path, agent);
    expect(forced).toMatchObject({ agent, event: { kind: 'edit', filePath: 'src/a.ts' } });

    const explicit = await detectAndParse(
      JSON.stringify({
        agent,
        hook_event_name: eventName,
        session_id: 's1',
        cwd: repo.path,
        file_path: 'src/a.ts',
      }),
      repo.path,
    );
    expect(explicit).toMatchObject({ agent, event: { kind: 'edit' } });
  });

  it('rejects an explicit unknown agent id', async () => {
    expect(await detectAndParse(JSON.stringify({ agent: 'unknown-bot', prompt: 'x', cwd: repo.path }), repo.path)).toBeNull();
    expect(await detectAndParse('{"prompt":"x"}', repo.path, 'unknown-bot')).toBeNull();
  });

  it('does not invent an event when forced agent payload is not a valid contract', async () => {
    expect(await detectAndParse(JSON.stringify({ nonsense: true }), repo.path, 'windsurf')).toBeNull();
    expect(await detectAndParse('not-json', repo.path, 'cline')).toBeNull();
  });

  it('auto-detects best-effort windsurf without --agent', async () => {
    const parsed = await detectAndParse(
      JSON.stringify({
        hook_event_name: 'post_file_edit',
        session_id: 's1',
        cwd: repo.path,
        file_path: 'src/a.ts',
      }),
      repo.path,
    );
    expect(parsed).toMatchObject({ agent: 'windsurf', event: { kind: 'edit' } });
  });
});

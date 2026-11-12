import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { detectAndParse } from '../../src/agents/detect.js';
import { parseCline } from '../../src/agents/cline.js';
import { parseCursor } from '../../src/agents/cursor.js';
import { parseGenericAgent } from '../../src/agents/generic.js';
import { maturityOf } from '../../src/agents/ids.js';
import { parseRoo } from '../../src/agents/roo.js';
import { parseWindsurf } from '../../src/agents/windsurf.js';
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

  it('parses dedicated windsurf fixtures with session + cwd', async () => {
    expect(maturityOf('windsurf')).toBe('best-effort');
    const edit = await parseWindsurf(
      JSON.stringify({
        hook_event_name: 'post_file_edit',
        session_id: 'ws-1',
        cwd: repo.path,
        file_path: 'src/a.ts',
        tool_input: { language: 'typescript' },
      }),
      repo.path,
    );
    expect(edit).toMatchObject({
      agent: 'windsurf',
      event: { kind: 'edit', filePath: 'src/a.ts', sessionId: 'ws-1', agent: 'windsurf' },
    });

    const prompt = await parseWindsurf(
      JSON.stringify({
        hook_event_name: 'pre_user_prompt',
        conversation_id: 'ws-1',
        cwd: repo.path,
        prompt: 'refactor hooks',
      }),
      repo.path,
    );
    expect(prompt).toMatchObject({ agent: 'windsurf', event: { kind: 'prompt', sessionId: 'ws-1' } });
  });

  it('parses dedicated cline fixtures', async () => {
    expect(maturityOf('cline')).toBe('best-effort');
    const edit = await parseCline(
      JSON.stringify({
        hook_event_name: 'file_edited',
        thread_id: 'cl-1',
        cwd: repo.path,
        path: 'src/a.ts',
      }),
      repo.path,
    );
    expect(edit).toMatchObject({ agent: 'cline', event: { kind: 'edit', filePath: 'src/a.ts', sessionId: 'cl-1' } });

    const prompt = await parseCline(
      JSON.stringify({
        hook_event_name: 'task_prompt',
        thread_id: 'cl-1',
        cwd: repo.path,
        user_message: 'add tests',
      }),
      repo.path,
    );
    expect(prompt).toMatchObject({ agent: 'cline', event: { kind: 'prompt', sessionId: 'cl-1' } });
  });

  it('parses dedicated roo fixtures', async () => {
    expect(maturityOf('roo')).toBe('best-effort');
    const edit = await parseRoo(
      JSON.stringify({
        event: 'file_written',
        chat_id: 'ro-1',
        cwd: repo.path,
        filePath: 'src/a.ts',
      }),
      repo.path,
    );
    expect(edit).toMatchObject({ agent: 'roo', event: { kind: 'edit', filePath: 'src/a.ts', sessionId: 'ro-1' } });

    const prompt = await parseRoo(
      JSON.stringify({
        hook_event_name: 'UserPromptSubmit',
        chat_id: 'ro-1',
        cwd: repo.path,
        message: 'ship it',
      }),
      repo.path,
    );
    expect(prompt).toMatchObject({ agent: 'roo', event: { kind: 'prompt', sessionId: 'ro-1' } });
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
    expect(await parseGenericAgent(JSON.stringify({ nonsense: true }), repo.path, 'aider', true)).toBeNull();
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

  it('auto-detects cline and roo by dedicated event names', async () => {
    const cline = await detectAndParse(
      JSON.stringify({
        hook_event_name: 'task_prompt',
        session_id: 's1',
        cwd: repo.path,
        prompt: 'hi',
      }),
      repo.path,
    );
    expect(cline).toMatchObject({ agent: 'cline', event: { kind: 'prompt' } });

    const roo = await detectAndParse(
      JSON.stringify({
        hook_event_name: 'file_written',
        session_id: 's1',
        cwd: repo.path,
        file_path: 'src/a.ts',
      }),
      repo.path,
    );
    expect(roo).toMatchObject({ agent: 'roo', event: { kind: 'edit' } });
  });
});

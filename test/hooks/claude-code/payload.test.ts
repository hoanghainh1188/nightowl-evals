import { describe, expect, it } from 'vitest';
import { parseHookPayload } from '../../../src/hooks/claude-code/payload.js';
import { hookFixture } from '../../helpers/fixtures.js';

describe('parseHookPayload', () => {
  it('reads a UserPromptSubmit payload', () => {
    expect(parseHookPayload(hookFixture('user-prompt-submit', '/repo'))).toEqual({
      event: 'UserPromptSubmit',
      sessionId: 's1',
      cwd: '/repo',
      prompt: 'thêm validate email cho form đăng ký',
    });
  });

  it('reads a PostToolUse payload with its tool input', () => {
    expect(parseHookPayload(hookFixture('post-tool-use-edit', '/repo'))).toEqual({
      event: 'PostToolUse',
      sessionId: 's1',
      cwd: '/repo',
      toolName: 'Edit',
      toolInput: {
        file_path: '/repo/src/a.ts',
        old_string: 'return true;',
        new_string: 'return EMAIL.test(value);',
        replace_all: false,
      },
    });
  });

  it.each([
    ['not JSON', 'not json'],
    ['a JSON array', '[]'],
    ['an unknown event', '{"hook_event_name":"Stop","session_id":"s","cwd":"/r"}'],
    ['a prompt that is not text', '{"hook_event_name":"UserPromptSubmit","session_id":"s","cwd":"/r","prompt":1}'],
    ['a tool use without input', '{"hook_event_name":"PostToolUse","session_id":"s","cwd":"/r","tool_name":"Edit"}'],
    ['a missing cwd', '{"hook_event_name":"UserPromptSubmit","session_id":"s","prompt":"p"}'],
  ])('returns null for %s', (_label, text) => {
    expect(parseHookPayload(text)).toBeNull();
  });

  it('accepts a missing session id', () => {
    const parsed = parseHookPayload('{"hook_event_name":"UserPromptSubmit","cwd":"/r","prompt":"p"}');
    expect(parsed).toMatchObject({ sessionId: null });
  });
});

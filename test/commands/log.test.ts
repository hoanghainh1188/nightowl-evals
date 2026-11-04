import { describe, expect, it } from 'vitest';
import { LOG_STDIN_TIMEOUT_MS, logCommand } from '../../src/commands/log.js';
import { createFakeIo, type FakeIoOptions } from '../helpers/fake-io.js';

const cases: ReadonlyArray<[string, FakeIoOptions]> = [
  ['valid JSON', { stdin: '{"hook_event_name":"PostToolUse","tool_name":"Edit"}' }],
  ['invalid JSON', { stdin: 'not json' }],
  ['empty stdin', { stdin: '' }],
  ['a failing stdin read', { readError: new Error('EPIPE') }],
];

describe('log', () => {
  it.each(cases)('exits 0 silently for %s', async (_label, options) => {
    const fake = createFakeIo(options);
    const code = await logCommand.run([], fake.io);
    expect(code).toBe(0);
    expect(fake.out()).toBe('');
    expect(fake.err()).toBe('');
    expect(fake.stdinReads()).toBe(1);
  });

  it('bounds the stdin read so a stuck pipe cannot block the hook', async () => {
    const fake = createFakeIo({ stdin: '{}' });
    await logCommand.run([], fake.io);
    expect(fake.stdinTimeouts()).toEqual([LOG_STDIN_TIMEOUT_MS]);
    expect(LOG_STDIN_TIMEOUT_MS).toBeLessThan(1_000);
  });

  it('does not wait on stdin when it is an interactive terminal', async () => {
    const fake = createFakeIo({ isTTY: true });
    const code = await logCommand.run([], fake.io);
    expect(code).toBe(0);
    expect(fake.stdinReads()).toBe(0);
    expect(fake.out()).toBe('');
    expect(fake.err()).toBe('');
  });
});

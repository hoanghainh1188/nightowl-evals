import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { type GuardTarget, installProcessGuards } from '../../src/cli/guards.js';

class ExitSignal extends Error {
  constructor(readonly code: number) {
    super(`exit ${code}`);
  }
}

function createTarget() {
  const events = new EventEmitter();
  const stdout = new EventEmitter();
  const stderrEvents = new EventEmitter();
  const written: string[] = [];
  const target: GuardTarget = {
    stdout,
    stderr: {
      on: (event, listener) => stderrEvents.on(event, listener),
      write: (text: string) => written.push(text),
    },
    on: (event, listener) => events.on(event, listener),
    exit: (code: number): never => {
      throw new ExitSignal(code);
    },
  };
  const exitCodeOf = (event: string, error: unknown): number => {
    try {
      events.emit(event, error);
    } catch (signal) {
      if (signal instanceof ExitSignal) return signal.code;
      throw signal;
    }
    throw new Error('guard did not exit');
  };
  return { target, stdout, stderrEvents, written, exitCodeOf };
}

describe('installProcessGuards', () => {
  it('ignores write errors such as EPIPE on stdout and stderr', () => {
    const { target, stdout, stderrEvents } = createTarget();
    installProcessGuards(['--help'], target);
    const epipe = Object.assign(new Error('write EPIPE'), { code: 'EPIPE' });
    expect(() => stdout.emit('error', epipe)).not.toThrow();
    expect(() => stderrEvents.emit('error', epipe)).not.toThrow();
  });

  it.each([
    ['uncaughtException', 'log'],
    ['unhandledRejection', 'log'],
    ['uncaughtException', 'precommit'],
  ])('exits 0 silently on %s for the %s hook', (event, command) => {
    const { target, written, exitCodeOf } = createTarget();
    installProcessGuards([command], target);
    expect(exitCodeOf(event, new Error('boom'))).toBe(0);
    expect(written).toEqual([]);
  });

  it.each(['uncaughtException', 'unhandledRejection'])('reports and exits 1 on %s for other commands', (event) => {
    const { target, written, exitCodeOf } = createTarget();
    installProcessGuards(['report'], target);
    expect(exitCodeOf(event, new Error('boom'))).toBe(1);
    expect(written).toEqual(['nightowl: boom\n']);
  });
});

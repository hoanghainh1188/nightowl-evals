import { describe, expect, it } from 'vitest';
import { consumeKey } from '../../src/review/tui/keys.js';

describe('consumeKey', () => {
  it('maps arrows, vim keys, actions, and quit', () => {
    expect(consumeKey('\u001b[A')?.key).toEqual({ type: 'up' });
    expect(consumeKey('\u001b[B')?.key).toEqual({ type: 'down' });
    expect(consumeKey('k')?.key).toEqual({ type: 'up' });
    expect(consumeKey('j')?.key).toEqual({ type: 'down' });
    expect(consumeKey(' ')?.key).toEqual({ type: 'toggleDiff' });
    expect(consumeKey('\r')?.key).toEqual({ type: 'toggleDiff' });
    expect(consumeKey('c')?.key).toEqual({ type: 'confirm' });
    expect(consumeKey('d')?.key).toEqual({ type: 'dismiss' });
    expect(consumeKey('r')?.key).toEqual({ type: 'reset' });
    expect(consumeKey('q')?.key).toEqual({ type: 'quit' });
    expect(consumeKey('\u0003')?.key).toEqual({ type: 'quit' });
  });

  it('waits for incomplete escape sequences', () => {
    expect(consumeKey('\u001b')).toBeNull();
    expect(consumeKey('\u001b[')).toBeNull();
  });

  it('leaves the remainder of the buffer', () => {
    expect(consumeKey('qj')?.rest).toBe('j');
  });
});

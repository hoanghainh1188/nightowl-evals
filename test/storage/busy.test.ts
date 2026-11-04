import { describe, expect, it } from 'vitest';
import { isBusy, retryWhileBusy } from '../../src/storage/busy.js';

const busy = Object.assign(new Error('database is locked'), { errcode: 5 });

describe('retryWhileBusy', () => {
  it('retries SQLITE_BUSY until the step succeeds', async () => {
    let calls = 0;
    await retryWhileBusy(() => {
      calls += 1;
      if (calls < 3) throw busy;
    }, 1_000);
    expect(calls).toBe(3);
  });

  it('rethrows other errors immediately', async () => {
    let calls = 0;
    const step = () => {
      calls += 1;
      throw new Error('disk I/O error');
    };
    await expect(retryWhileBusy(step, 1_000)).rejects.toThrow('disk I/O error');
    expect(calls).toBe(1);
  });

  it('gives up after the timeout', async () => {
    await expect(
      retryWhileBusy(() => {
        throw busy;
      }, 60),
    ).rejects.toBe(busy);
  });

  it('recognises only SQLITE_BUSY', () => {
    expect(isBusy(busy)).toBe(true);
    expect(isBusy({ errcode: 19 })).toBe(false);
    expect(isBusy('busy')).toBe(false);
  });
});

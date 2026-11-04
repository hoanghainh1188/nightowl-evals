import { describe, expect, it } from 'vitest';
import { parseDateOption } from '../src/shared/date-option.js';

describe('parseDateOption', () => {
  it('returns the start of the day in UTC', () => {
    expect(parseDateOption('2026-11-04')).toBe('2026-11-04T00:00:00.000Z');
    expect(parseDateOption('2024-02-29')).toBe('2024-02-29T00:00:00.000Z');
  });

  it.each(['04/11/2026', '2026-11-4', '2026-13-01', '2026-02-30', '2025-02-29', '', 'yesterday'])('rejects %j', (value) => {
    expect(parseDateOption(value)).toBeNull();
  });
});

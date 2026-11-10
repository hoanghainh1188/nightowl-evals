import { describe, expect, it } from 'vitest';
import { BODY_LIMIT, parsePrCommentsJson } from '../../src/ingest/pr-comments.js';

describe('parsePrCommentsJson', () => {
  it('parses a comments array and truncates long bodies', () => {
    const long = 'x'.repeat(BODY_LIMIT + 20);
    const records = parsePrCommentsJson(
      JSON.stringify([{ id: '9', path: 'src/a.ts', body: long, line: 3, user: 'alice' }]),
      '12',
    );
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      commentId: '9',
      path: 'src/a.ts',
      line: 3,
      user: 'alice',
      pr: '12',
    });
    expect(records[0]!.body.length).toBe(BODY_LIMIT + 1);
    expect(records[0]!.body.endsWith('…')).toBe(true);
  });
});

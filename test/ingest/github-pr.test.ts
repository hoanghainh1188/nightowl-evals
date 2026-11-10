import { describe, expect, it, vi } from 'vitest';
import { fetchPullReviewComments } from '../../src/ingest/github-pr.js';

describe('fetchPullReviewComments', () => {
  it('follows Link rel=next pages', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('page=2') || url.includes('page%3D2')) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: { get: () => null },
          json: async () => [{ id: 2, path: 'b.ts', body: 'second' }],
        };
      }
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: (name: string) =>
            name.toLowerCase() === 'link'
              ? '<https://api.github.com/repos/acme/app/pulls/1/comments?per_page=100&page=2>; rel="next"'
              : null,
        },
        json: async () => [{ id: 1, path: 'a.ts', body: 'first' }],
      };
    });
    const records = await fetchPullReviewComments({
      token: 't',
      repository: 'acme/app',
      pr: 1,
      fetch: fetchMock as unknown as typeof fetch,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(records.map((r) => r.commentId)).toEqual(['1', '2']);
  });
});

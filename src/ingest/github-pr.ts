import { githubCommentsToRecords, type PrReviewRecord } from './pr-comments.js';

export interface GithubPrFetch {
  readonly token: string;
  readonly repository: string; // owner/repo
  readonly pr: number;
  readonly fetch?: typeof fetch;
  /** Max pages to follow (default 10 = up to 1000 comments). */
  readonly maxPages?: number;
}

export class GithubPrError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GithubPrError';
  }
}

function nextLink(linkHeader: string | null): string | null {
  if (linkHeader === null || linkHeader.length === 0) return null;
  for (const part of linkHeader.split(',')) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="next"/i);
    if (match !== null) return match[1] ?? null;
  }
  return null;
}

export async function fetchPullReviewComments(options: GithubPrFetch): Promise<readonly PrReviewRecord[]> {
  const match = options.repository.match(/^([^/]+)\/([^/]+)$/);
  if (match === null) throw new GithubPrError(`invalid GITHUB_REPOSITORY (expected owner/repo): ${options.repository}`);
  const [, owner, repo] = match;
  const doFetch = options.fetch ?? globalThis.fetch;
  if (typeof doFetch !== 'function') throw new GithubPrError('fetch is not available in this runtime');

  const maxPages = options.maxPages ?? 10;
  const collected: unknown[] = [];
  let url: string | null = `https://api.github.com/repos/${owner}/${repo}/pulls/${options.pr}/comments?per_page=100`;
  let pages = 0;
  while (url !== null && pages < maxPages) {
    pages += 1;
    const response = await doFetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${options.token}`,
        'User-Agent': 'nightowl-evals',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!response.ok) {
      throw new GithubPrError(`GitHub API ${response.status} ${response.statusText} for ${url}`);
    }
    const body = (await response.json()) as unknown;
    if (!Array.isArray(body)) throw new GithubPrError('GitHub API returned a non-array review comments payload');
    collected.push(...body);
    url = nextLink(response.headers?.get?.('link') ?? null);
  }
  if (url !== null) {
    throw new GithubPrError(`GitHub review comments exceeded ${maxPages} pages; narrow the PR or raise maxPages`);
  }
  return githubCommentsToRecords(collected, String(options.pr));
}

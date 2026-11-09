import { describe, expect, it, vi } from 'vitest';
import { CLASSIFICATION_SCHEMA } from '../../src/classify/parse.js';
import {
  AnthropicApiError,
  ANTHROPIC_API_URL,
  resolveApiModel,
  runAnthropicApi,
} from '../../src/classify/run-api.js';

const classificationJson = JSON.stringify({ category: 'logic', reason: 'bug', confidence: 0.9 });

function apiResponse(text: string, status = 200): Response {
  return new Response(JSON.stringify({ content: [{ type: 'text', text }] }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('resolveApiModel', () => {
  it('maps short aliases to pinned ids', () => {
    expect(resolveApiModel('haiku')).toBe('claude-haiku-4-5-20251001');
    expect(resolveApiModel('sonnet')).toBe('claude-sonnet-4-5-20250929');
    expect(resolveApiModel('opus')).toBe('claude-opus-4-5-20251101');
  });

  it('passes through full model ids', () => {
    expect(resolveApiModel('claude-haiku-4-5-20251001')).toBe('claude-haiku-4-5-20251001');
  });
});

describe('runAnthropicApi', () => {
  it('posts to Anthropic and wraps JSON text for parseClaudeOutput', async () => {
    const fetchMock = vi.fn(async () => apiResponse(classificationJson));
    const stdout = await runAnthropicApi('classify this', {
      model: 'haiku',
      schema: CLASSIFICATION_SCHEMA,
      apiKey: 'sk-test',
      fetch: fetchMock as unknown as typeof fetch,
    });
    expect(JSON.parse(stdout)).toEqual({
      type: 'result',
      structured_output: { category: 'logic', reason: 'bug', confidence: 0.9 },
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    const [url, init] = call as unknown as [string, RequestInit];
    expect(url).toBe(ANTHROPIC_API_URL);
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-test');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    const body = JSON.parse(String(init.body)) as { model: string; output_config: unknown };
    expect(body.model).toBe('claude-haiku-4-5-20251001');
    expect(body.output_config).toMatchObject({ format: { type: 'json_schema' } });
  });

  it('fails when the API key is missing', async () => {
    await expect(
      runAnthropicApi('x', { model: 'haiku', schema: CLASSIFICATION_SCHEMA, apiKey: '' }),
    ).rejects.toMatchObject({ reason: 'missing_key' } satisfies Partial<AnthropicApiError>);
  });

  it('maps HTTP errors', async () => {
    const fetchMock = vi.fn(async () => new Response('unauthorized', { status: 401 }));
    await expect(
      runAnthropicApi('x', {
        model: 'haiku',
        schema: CLASSIFICATION_SCHEMA,
        apiKey: 'sk-test',
        fetch: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ reason: 'http', message: expect.stringContaining('401') });
  });

  it('maps abort/timeout', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
    });
    await expect(
      runAnthropicApi('x', {
        model: 'haiku',
        schema: CLASSIFICATION_SCHEMA,
        apiKey: 'sk-test',
        timeoutMs: 20,
        fetch: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ reason: 'timeout' });
  });
});

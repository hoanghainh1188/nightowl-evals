import { CLAUDE_TIMEOUT_MS } from './run-claude.js';

export const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
export const ANTHROPIC_API_HOST = 'api.anthropic.com';
export const ANTHROPIC_VERSION = '2023-06-01';
export const ANTHROPIC_API_KEY_ENV = 'ANTHROPIC_API_KEY';

// Short CLI aliases map to pinned Messages API model ids.
export const API_MODEL_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-5-20250929',
  opus: 'claude-opus-4-5-20251101',
});

export function resolveApiModel(model: string): string {
  return API_MODEL_ALIASES[model] ?? model;
}

export class AnthropicApiError extends Error {
  constructor(
    message: string,
    readonly reason: 'missing_key' | 'timeout' | 'http' | 'invalid_response',
  ) {
    super(message);
    this.name = 'AnthropicApiError';
  }
}

export interface RunAnthropicApiOptions {
  readonly model: string;
  readonly schema: object;
  readonly timeoutMs?: number;
  readonly apiKey?: string;
  readonly fetch?: typeof fetch;
}

export type RunAnthropicApi = (prompt: string, options: RunAnthropicApiOptions) => Promise<string>;

function readTextContent(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || !('content' in body)) return null;
  const content = (body as { content: unknown }).content;
  if (!Array.isArray(content)) return null;
  const texts = content
    .filter((block): block is { type: string; text: string } => {
      return typeof block === 'object' && block !== null && (block as { type?: string }).type === 'text' && typeof (block as { text?: unknown }).text === 'string';
    })
    .map((block) => block.text);
  return texts.length === 0 ? null : texts.join('');
}

// Returns the same envelope shape as `claude -p --output-format json` so parseClaudeOutput can be reused.
function toClaudeEnvelope(structured: unknown): string {
  return JSON.stringify({ type: 'result', structured_output: structured });
}

export const runAnthropicApi: RunAnthropicApi = async (prompt, options) => {
  const apiKey = options.apiKey ?? process.env[ANTHROPIC_API_KEY_ENV];
  if (apiKey === undefined || apiKey.trim() === '') {
    throw new AnthropicApiError(
      `set ${ANTHROPIC_API_KEY_ENV} to use --transport api`,
      'missing_key',
    );
  }
  const doFetch = options.fetch ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? CLAUDE_TIMEOUT_MS);
  try {
    const response = await doFetch(ANTHROPIC_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: resolveApiModel(options.model),
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
        output_config: {
          format: {
            type: 'json_schema',
            schema: options.schema,
          },
        },
      }),
    });
    const raw = await response.text();
    if (!response.ok) {
      const detail = raw.trim().slice(0, 300);
      throw new AnthropicApiError(
        detail === '' ? `Anthropic API HTTP ${response.status}` : `Anthropic API HTTP ${response.status}: ${detail}`,
        'http',
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      throw new AnthropicApiError('Anthropic API returned non-JSON', 'invalid_response');
    }
    const text = readTextContent(parsed);
    if (text === null || text.trim() === '') {
      throw new AnthropicApiError('Anthropic API response has no text content', 'invalid_response');
    }
    let structured: unknown;
    try {
      structured = JSON.parse(text) as unknown;
    } catch {
      throw new AnthropicApiError('Anthropic API text is not JSON', 'invalid_response');
    }
    return toClaudeEnvelope(structured);
  } catch (error) {
    if (error instanceof AnthropicApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AnthropicApiError('Anthropic API did not answer in time', 'timeout');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

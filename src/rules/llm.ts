import { ANTHROPIC_API_KEY_ENV, resolveApiModel, type RunAnthropicApi } from '../classify/run-api.js';
import type { RunClaude } from '../classify/run-claude.js';
import { containsInlineSecret } from '../hooks/claude-code/sensitive.js';
import { readClaudeAnswer } from '../shared/claude-answer.js';
import { truncateUtf8 } from '../shared/truncate.js';
import type { SuggestedRule } from './types.js';

export type RulesTransport = 'cli' | 'api';

export interface RulesLlmDeps {
  readonly runClaude: RunClaude;
  readonly runApi: RunAnthropicApi;
  readonly env: () => NodeJS.ProcessEnv;
}

const MAX_TITLE = 200;
const MAX_BODY = 4000;

export const RULES_LLM_SCHEMA = Object.freeze({
  type: 'object',
  required: ['rules'],
  additionalProperties: false,
  properties: {
    rules: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'body'],
        additionalProperties: false,
        properties: {
          title: { type: 'string', maxLength: MAX_TITLE },
          body: { type: 'string', maxLength: MAX_BODY },
        },
      },
    },
  },
});

function promptFor(rules: readonly SuggestedRule[]): string {
  const draft = rules
    .map(
      (rule, i) =>
        `### Draft ${i + 1}\nTitle: ${rule.title}\nCategory: ${rule.cluster.category}\nModule: ${rule.cluster.module}\nCount: ${rule.cluster.count}\n\n${rule.body}`,
    )
    .join('\n\n');
  return [
    'You rewrite NightOwl failure clusters into concise project coding rules.',
    `Return exactly ${rules.length} rules in the same order.`,
    'Keep the same facts (paths, counts, categories). Do not invent APIs or files.',
    'Do not include secrets. Prefer short imperative guidance.',
    '',
    draft,
  ].join('\n');
}

function parseLlmRules(stdout: string, fallback: readonly SuggestedRule[]): readonly SuggestedRule[] | null {
  const read = readClaudeAnswer(stdout, 'rules');
  if (!read.ok) return null;
  const raw = read.answer.rules;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const rewritten: SuggestedRule[] = [];
  for (let i = 0; i < fallback.length; i += 1) {
    const base = fallback[i]!;
    const item = raw[i];
    if (item === undefined || typeof item !== 'object' || item === null) {
      rewritten.push(base);
      continue;
    }
    const record = item as Record<string, unknown>;
    const titleRaw = typeof record.title === 'string' ? record.title.trim() : '';
    const bodyRaw = typeof record.body === 'string' ? record.body.trim() : '';
    const title = truncateUtf8(titleRaw || base.title, MAX_TITLE).text;
    const body = truncateUtf8(bodyRaw || base.body, MAX_BODY).text;
    if (containsInlineSecret(title) || containsInlineSecret(body)) {
      rewritten.push(base);
      continue;
    }
    rewritten.push(Object.freeze({ ...base, title, body, source: 'llm' as const }));
  }
  return Object.freeze(rewritten);
}

export async function enrichRulesWithLlm(
  heuristic: readonly SuggestedRule[],
  options: { readonly transport: RulesTransport; readonly model: string },
  deps: RulesLlmDeps,
): Promise<readonly SuggestedRule[]> {
  if (heuristic.length === 0) return heuristic;
  const prompt = promptFor(heuristic);
  try {
    let text: string;
    if (options.transport === 'api') {
      const apiKey = deps.env()[ANTHROPIC_API_KEY_ENV];
      text = await deps.runApi(prompt, {
        model: resolveApiModel(options.model),
        schema: RULES_LLM_SCHEMA,
        ...(apiKey === undefined ? {} : { apiKey }),
      });
    } else {
      text = await deps.runClaude(prompt, { model: options.model, schema: RULES_LLM_SCHEMA });
    }
    return parseLlmRules(text, heuristic) ?? heuristic;
  } catch {
    return heuristic;
  }
}

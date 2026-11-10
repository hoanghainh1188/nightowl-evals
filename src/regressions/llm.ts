import { ANTHROPIC_API_KEY_ENV, resolveApiModel, type RunAnthropicApi } from '../classify/run-api.js';
import type { RunClaude } from '../classify/run-claude.js';
import { containsInlineSecret } from '../hooks/claude-code/sensitive.js';
import { readClaudeAnswer } from '../shared/claude-answer.js';
import { truncateUtf8 } from '../shared/truncate.js';
import type { RegressionScaffold } from './types.js';

export type RegressionTransport = 'cli' | 'api';

export interface RegressionLlmDeps {
  readonly runClaude: RunClaude;
  readonly runApi: RunAnthropicApi;
  readonly env: () => NodeJS.ProcessEnv;
}

const MAX_TITLE = 200;
const MAX_DESCRIPTION = 500;

export const REGRESSION_LLM_SCHEMA = Object.freeze({
  type: 'object',
  required: ['items'],
  additionalProperties: false,
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'description'],
        additionalProperties: false,
        properties: {
          title: { type: 'string', maxLength: MAX_TITLE },
          description: { type: 'string', maxLength: MAX_DESCRIPTION },
        },
      },
    },
  },
});

function promptFor(scaffolds: readonly RegressionScaffold[]): string {
  const draft = scaffolds
    .map(
      (s, i) =>
        `### ${i + 1}\nId: ${s.id}\nFile: ${s.evalCase.file_path}\nCategory: ${s.evalCase.category ?? 'unclassified'}\nTitle: ${s.title}\nDescription: ${s.description}`,
    )
    .join('\n\n');
  return [
    'Rewrite NightOwl regression scaffold titles and short descriptions.',
    `Return exactly ${scaffolds.length} items in the same order.`,
    'Do not invent APIs or files. Do not include secrets or code bodies.',
    '',
    draft,
  ].join('\n');
}

function parseItems(stdout: string, fallback: readonly RegressionScaffold[]): readonly RegressionScaffold[] | null {
  const read = readClaudeAnswer(stdout, 'items');
  if (!read.ok) return null;
  const raw = read.answer.items;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const rewritten: RegressionScaffold[] = [];
  for (let i = 0; i < fallback.length; i += 1) {
    const base = fallback[i]!;
    const item = raw[i];
    if (item === undefined || typeof item !== 'object' || item === null) {
      rewritten.push(base);
      continue;
    }
    const record = item as Record<string, unknown>;
    const titleRaw = typeof record.title === 'string' ? record.title.trim() : '';
    const descRaw = typeof record.description === 'string' ? record.description.trim() : '';
    const title = truncateUtf8(titleRaw || base.title, MAX_TITLE).text;
    const description = truncateUtf8(descRaw || base.description, MAX_DESCRIPTION).text;
    if (containsInlineSecret(title) || containsInlineSecret(description)) {
      rewritten.push(base);
      continue;
    }
    rewritten.push(Object.freeze({ ...base, title, description, source: 'llm' as const }));
  }
  return Object.freeze(rewritten);
}

export async function enrichRegressionsWithLlm(
  scaffolds: readonly RegressionScaffold[],
  options: { readonly transport: RegressionTransport; readonly model: string },
  deps: RegressionLlmDeps,
): Promise<readonly RegressionScaffold[]> {
  if (scaffolds.length === 0) return scaffolds;
  const prompt = promptFor(scaffolds);
  try {
    let text: string;
    if (options.transport === 'api') {
      const apiKey = deps.env()[ANTHROPIC_API_KEY_ENV];
      text = await deps.runApi(prompt, {
        model: resolveApiModel(options.model),
        schema: REGRESSION_LLM_SCHEMA,
        ...(apiKey === undefined ? {} : { apiKey }),
      });
    } else {
      text = await deps.runClaude(prompt, { model: options.model, schema: REGRESSION_LLM_SCHEMA });
    }
    return parseItems(text, scaffolds) ?? scaffolds;
  } catch {
    return scaffolds;
  }
}

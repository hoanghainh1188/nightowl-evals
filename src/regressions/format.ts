import { EVAL_SCHEMA } from '../export/eval-case.js';
import type { RegressionFramework, RegressionScaffold } from './types.js';
import { REGRESSION_MARKER } from './types.js';

export function formatJsonFixture(scaffold: RegressionScaffold): string {
  return `${JSON.stringify(scaffold.evalCase, null, 2)}\n`;
}

export function isNightOwlEvalJson(content: string): boolean {
  const trimmed = content.trim();
  if (trimmed === '') return true;
  try {
    const parsed = JSON.parse(trimmed) as { schema?: unknown };
    return parsed.schema === EVAL_SCHEMA || (typeof parsed.schema === 'string' && parsed.schema.startsWith('nightowl.eval/'));
  } catch {
    return false;
  }
}

export function hasRegressionMarker(content: string): boolean {
  return content.includes(REGRESSION_MARKER);
}

function escapeForString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
}

export function formatStubTest(scaffold: RegressionScaffold, framework: 'vitest' | 'jest', fixtureFileName: string): string {
  const runner = framework === 'vitest' ? "import { describe, it } from 'vitest';" : "import { describe, it } from '@jest/globals';";
  const title = escapeForString(scaffold.title);
  const description = escapeForString(scaffold.description);
  return [
    REGRESSION_MARKER,
    runner,
    '',
    `describe('${title}', () => {`,
    `  // Fixture: ${fixtureFileName}`,
    `  // ${description}`,
    `  // via=${scaffold.source}`,
    `  it.todo('assert corrected behavior for ${escapeForString(scaffold.evalCase.file_path)}');`,
    '});',
    '',
  ].join('\n');
}

export function formatPreview(scaffolds: readonly RegressionScaffold[], framework: RegressionFramework): string {
  if (scaffolds.length === 0) return 'No regression scaffolds to emit.\n';
  const lines = scaffolds.map((scaffold, i) => {
    const files =
      framework === 'json'
        ? `${scaffold.id}.json`
        : `${scaffold.id}.json + ${scaffold.id}.test.ts`;
    return `${i + 1}. ${scaffold.id}  ${scaffold.title}  (${scaffold.source}) → ${files}`;
  });
  return `Would write ${scaffolds.length} regression scaffold(s) [${framework}]:\n${lines.join('\n')}\n`;
}

export function fixtureFileName(id: string): string {
  return `${id}.json`;
}

export function stubFileName(id: string): string {
  return `${id}.test.ts`;
}

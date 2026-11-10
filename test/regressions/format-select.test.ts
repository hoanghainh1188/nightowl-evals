import { describe, expect, it } from 'vitest';
import { EVAL_SCHEMA } from '../../src/export/eval-case.js';
import { detectFramework } from '../../src/regressions/detect.js';
import {
  formatJsonFixture,
  formatPreview,
  formatStubTest,
  hasRegressionMarker,
  isNightOwlEvalJson,
} from '../../src/regressions/format.js';
import { selectRegressionScaffolds } from '../../src/regressions/select.js';
import type { FailureForRegression } from '../../src/regressions/types.js';
import { REGRESSION_MARKER } from '../../src/regressions/types.js';
import { createTempDir, writeFiles } from '../helpers/temp-repo.js';

function failure(partial: Partial<FailureForRegression> & Pick<FailureForRegression, 'id' | 'filePath'>): FailureForRegression {
  return Object.freeze({
    createdAt: '2026-11-04T10:00:00.000Z',
    commitSha: 'abcdef0123456789',
    prompt: 'fix it',
    aiContent: 'ai\n',
    finalContent: 'dev\n',
    category: 'logic',
    categoryReason: 'edge case',
    categoryConfidence: 0.9,
    source: 'manual-fix',
    feedback: null,
    status: 'confirmed',
    agent: 'claude-code',
    ...partial,
  });
}

describe('regression select + format', () => {
  it('builds stable eval fixtures and skips secrets', () => {
    const secret = 'const key = "ghp_123456789012345678901234567890123456";\n';
    const selected = selectRegressionScaffolds(
      [
        failure({ id: 1, filePath: 'src/a.ts' }),
        failure({ id: 2, filePath: 'src/b.ts', aiContent: secret }),
        failure({ id: 3, filePath: '.env', aiContent: 'X=1\n' }),
      ],
      new Map(),
    );
    expect(selected.skippedSensitive).toBe(2);
    expect(selected.scaffolds).toHaveLength(1);
    expect(selected.scaffolds[0]?.id).toBe('abcdef012345-1');
    expect(selected.scaffolds[0]?.evalCase.schema).toBe(EVAL_SCHEMA);

    const json = formatJsonFixture(selected.scaffolds[0]!);
    expect(isNightOwlEvalJson(json)).toBe(true);
    expect(json).not.toContain('ghp_');

    const stub = formatStubTest(selected.scaffolds[0]!, 'vitest', 'abcdef012345-1.json');
    expect(hasRegressionMarker(stub)).toBe(true);
    expect(stub).toContain(REGRESSION_MARKER);
    expect(stub).toContain('it.todo');
    expect(stub).not.toContain('ghp_');

    expect(formatPreview(selected.scaffolds, 'json')).toContain('abcdef012345-1.json');
  });

  it('detects vitest from package.json', async () => {
    const dir = await createTempDir();
    try {
      await writeFiles(dir.path, {
        'package.json': JSON.stringify({ devDependencies: { vitest: '5.0.0' } }),
      });
      expect(await detectFramework(dir.path)).toBe('vitest');
    } finally {
      await dir.cleanup();
    }
  });
});

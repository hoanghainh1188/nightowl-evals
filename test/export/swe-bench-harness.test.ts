import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EVAL_SCHEMA } from '../../src/export/eval-case.js';
import { EMPTY_HARNESS, loadStubHarness } from '../../src/export/swe-bench-harness.js';
import { REGRESSION_MARKER } from '../../src/regressions/types.js';
import { createTempDir, type TempDir } from '../helpers/temp-repo.js';

describe('loadStubHarness', () => {
  let repo: TempDir;
  const id = 'abcdef123456-7';

  beforeEach(async () => {
    repo = await createTempDir();
    await mkdir(join(repo.path, 'test', 'regressions'), { recursive: true });
  });
  afterEach(() => repo.cleanup());

  it('returns null when stub is missing', async () => {
    expect(await loadStubHarness(join(repo.path, 'test/regressions'), id, repo.path)).toBeNull();
  });

  it('returns null for JSON fixture only', async () => {
    const dir = join(repo.path, 'test/regressions');
    await writeFile(
      join(dir, `${id}.json`),
      `${JSON.stringify({ schema: EVAL_SCHEMA, id }, null, 2)}\n`,
    );
    expect(await loadStubHarness(dir, id, repo.path)).toBeNull();
  });

  it('returns null when file lacks NightOwl marker', async () => {
    const dir = join(repo.path, 'test/regressions');
    await writeFile(join(dir, `${id}.test.ts`), "import { it } from 'vitest';\nit.todo('x');\n");
    expect(await loadStubHarness(dir, id, repo.path)).toBeNull();
  });

  it('loads matching stub into FAIL_TO_PASS and test_patch', async () => {
    const dir = join(repo.path, 'test/regressions');
    const stub = `${REGRESSION_MARKER}\nimport { describe, it } from 'vitest';\n\ndescribe('t', () => {\n  it.todo('assert');\n});\n`;
    await writeFile(join(dir, `${id}.test.ts`), stub);
    const harness = await loadStubHarness(dir, id, repo.path);
    expect(harness).not.toBeNull();
    expect(harness!.FAIL_TO_PASS).toEqual(['test/regressions/abcdef123456-7.test.ts']);
    expect(harness!.test_patch).toContain('--- a/test/regressions/abcdef123456-7.test.ts');
    expect(harness!.test_patch).toContain(`+${REGRESSION_MARKER}`);
  });

  it('ignores unrelated files in the same directory', async () => {
    const dir = join(repo.path, 'test/regressions');
    await writeFile(join(dir, 'other.test.ts'), `${REGRESSION_MARKER}\n`);
    await writeFile(join(dir, 'readme.md'), 'hello\n');
    expect(await loadStubHarness(dir, id, repo.path)).toBeNull();
  });

  it('returns null when stub path escapes the repository root', async () => {
    const outside = await createTempDir();
    try {
      const stub = `${REGRESSION_MARKER}\nimport { it } from 'vitest';\nit.todo('x');\n`;
      await writeFile(join(outside.path, `${id}.test.ts`), stub);
      expect(await loadStubHarness(outside.path, id, repo.path)).toBeNull();
    } finally {
      outside.cleanup();
    }
  });
});

describe('EMPTY_HARNESS', () => {
  it('is empty lists and blank test_patch', () => {
    expect(EMPTY_HARNESS.FAIL_TO_PASS).toEqual([]);
    expect(EMPTY_HARNESS.test_patch).toBe('');
  });
});

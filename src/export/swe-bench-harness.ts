import { readFile, stat } from 'node:fs/promises';
import { isAbsolute, join, relative, sep } from 'node:path';
import { hasRegressionMarker, stubFileName } from '../regressions/format.js';
import { filePatch } from './file-patch.js';

export interface SweBenchHarnessFields {
  readonly FAIL_TO_PASS: readonly string[];
  readonly test_patch: string;
}

export const EMPTY_HARNESS: SweBenchHarnessFields = Object.freeze({
  FAIL_TO_PASS: Object.freeze([]) as readonly string[],
  test_patch: '',
});

/** Repo-relative POSIX path, or null when the stub would escape the repository. */
function toPosixRelativeInsideRepo(repoRoot: string, absolutePath: string): string | null {
  const relRaw = relative(repoRoot, absolutePath);
  if (relRaw === '' || relRaw === '..' || relRaw.startsWith(`..${sep}`) || isAbsolute(relRaw)) {
    return null;
  }
  return relRaw.split(/[/\\]/).join('/');
}

/**
 * Load a NightOwl regression stub for SWE-bench harness fields.
 * Returns null when the stub is missing, not a file, or lacks the NightOwl marker.
 * Fixture JSON alone is not enough — a matching `{id}.test.ts` stub is required.
 */
export async function loadStubHarness(
  regressionsDir: string,
  instanceId: string,
  repoRoot: string,
): Promise<SweBenchHarnessFields | null> {
  const stubPath = join(regressionsDir, stubFileName(instanceId));
  let content: string;
  try {
    const info = await stat(stubPath);
    if (!info.isFile()) return null;
    content = await readFile(stubPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
  if (!hasRegressionMarker(content)) return null;
  const rel = toPosixRelativeInsideRepo(repoRoot, stubPath);
  if (rel === null) return null;
  return {
    FAIL_TO_PASS: Object.freeze([rel]),
    test_patch: filePatch(rel, '', '', content),
  };
}

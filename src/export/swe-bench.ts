import { basename } from 'node:path';
import { GitError, runGit } from '../hooks/git/run-git.js';
import type { FailureToExport } from '../storage/failures.js';
import { evalId } from './eval-case.js';
import { filePatch } from './file-patch.js';
import { SWE_BENCH_SCHEMA } from './formats.js';
import { EMPTY_HARNESS, type SweBenchHarnessFields } from './swe-bench-harness.js';

export interface SweBenchInstance {
  readonly schema: typeof SWE_BENCH_SCHEMA;
  readonly instance_id: string;
  readonly repo: string;
  readonly base_commit: string | null;
  readonly problem_statement: string;
  readonly patch: string;
  readonly test_patch: string;
  readonly created_at: string;
  readonly hints_text: string;
  readonly FAIL_TO_PASS: readonly string[];
  readonly PASS_TO_PASS: readonly string[];
  readonly version: string;
  readonly environment_setup_commit: string | null;
}

export async function resolveRepoName(root: string): Promise<string> {
  try {
    const url = (await runGit(['remote', 'get-url', 'origin'], { cwd: root, timeoutMs: 5_000 })).toString('utf8').trim();
    const match = /[:/](?<owner>[^/]+)\/(?<repo>[^/]+?)(?:\.git)?$/i.exec(url);
    if (match?.groups?.owner && match.groups.repo) return `${match.groups.owner}/${match.groups.repo}`;
  } catch (error) {
    if (!(error instanceof GitError)) throw error;
  }
  return basename(root);
}

export async function resolveBaseCommit(root: string, commitSha: string | null): Promise<string | null> {
  if (commitSha === null || commitSha.length === 0) return null;
  try {
    const parent = (await runGit(['rev-parse', `${commitSha}^`], { cwd: root, timeoutMs: 5_000 })).toString('utf8').trim();
    if (parent.length > 0) return parent;
  } catch (error) {
    if (!(error instanceof GitError)) throw error;
  }
  try {
    const self = (await runGit(['rev-parse', commitSha], { cwd: root, timeoutMs: 5_000 })).toString('utf8').trim();
    return self.length > 0 ? self : commitSha;
  } catch (error) {
    if (!(error instanceof GitError)) throw error;
    return commitSha;
  }
}

export function buildProblemStatement(failure: FailureToExport): string {
  const parts: string[] = [];
  parts.push(`Fix NightOwl-recorded AI failure in \`${failure.filePath}\`.`);
  if (failure.category) parts.push(`Category: ${failure.category}.`);
  if (failure.prompt) parts.push(`Original prompt:\n${failure.prompt}`);
  parts.push('Produce the corrected file contents. Do not repeat the defective AI output.');
  return parts.join('\n\n');
}

export function toSweBenchInstance(
  failure: FailureToExport,
  fileBefore: string | null,
  repo: string,
  baseCommit: string | null,
  harness: SweBenchHarnessFields | null = null,
): SweBenchInstance {
  const fields = harness ?? EMPTY_HARNESS;
  return {
    schema: SWE_BENCH_SCHEMA,
    instance_id: evalId(failure),
    repo,
    base_commit: baseCommit,
    problem_statement: buildProblemStatement(failure),
    patch: filePatch(failure.filePath, fileBefore, failure.aiContent, failure.finalContent),
    test_patch: fields.test_patch,
    created_at: failure.createdAt,
    hints_text: failure.feedback ?? '',
    FAIL_TO_PASS: fields.FAIL_TO_PASS,
    PASS_TO_PASS: [],
    version: '',
    environment_setup_commit: null,
  };
}

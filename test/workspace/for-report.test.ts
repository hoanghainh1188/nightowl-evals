import { describe, expect, it } from 'vitest';
import type { CheckCountRow } from '../../src/storage/report-queries.js';
import { scopeChecksForWorkspace, workspaceFailOnRateWarning } from '../../src/workspace/for-report.js';
import type { Workspace } from '../../src/workspace/types.js';

const ui: Workspace = { path: 'packages/ui', name: '@acme/ui' };
const api: Workspace = { path: 'packages/api', name: '@acme/api' };
const all = [ui, api];

const check = (
  filePath: string | null,
  count: number,
  outcome: CheckCountRow['outcome'] = 'not-a-failure',
): CheckCountRow => ({
  day: '2026-11-04',
  outcome,
  agent: 'claude-code',
  filePath,
  count,
});

describe('scopeChecksForWorkspace', () => {
  it('returns checks unchanged when no workspace filter', () => {
    const checks = [check('packages/ui/a.ts', 2), check(null, 1)];
    expect(scopeChecksForWorkspace(checks, null, all)).toEqual({
      scoped: checks,
      droppedNoPath: 0,
      fullChecked: 3,
    });
  });

  it('keeps only path-bearing checks in selected workspaces', () => {
    const checks = [
      check('packages/ui/src/a.ts', 2, 'failure'),
      check('packages/api/src/b.ts', 3),
      check(null, 4),
      check('', 1),
    ];
    const result = scopeChecksForWorkspace(checks, [ui], all);
    expect(result.fullChecked).toBe(10);
    expect(result.droppedNoPath).toBe(5);
    expect(result.scoped).toEqual([check('packages/ui/src/a.ts', 2, 'failure')]);
  });
});

describe('workspaceFailOnRateWarning', () => {
  it('is silent without both flags', () => {
    const scoped = scopeChecksForWorkspace([check(null, 2)], [ui], all);
    expect(workspaceFailOnRateWarning(false, true, scoped)).toBeNull();
    expect(workspaceFailOnRateWarning(true, false, scoped)).toBeNull();
  });

  it('warns when pathless checks are dropped from the scoped denominator', () => {
    const scoped = scopeChecksForWorkspace([check('packages/ui/a.ts', 1), check(null, 2)], [ui], all);
    expect(workspaceFailOnRateWarning(true, true, scoped)).toMatch(/lack file_path/);
  });

  it('warns when scoped checked is 0 while full-window has checks', () => {
    const scoped = scopeChecksForWorkspace([check('packages/api/a.ts', 3)], [ui], all);
    expect(workspaceFailOnRateWarning(true, true, scoped)).toMatch(/changedRate\.checked at 0/);
  });
});

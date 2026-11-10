import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ACTION_YML = join(import.meta.dirname, '../../action/action.yml');
const POST_COMMENT = join(import.meta.dirname, '../../action/scripts/post-comment.sh');

describe('post-comment script wiring', () => {
  it('upserts via marker and does not run when comment-on-pr is false', async () => {
    const [yml, script] = await Promise.all([readFile(ACTION_YML, 'utf8'), readFile(POST_COMMENT, 'utf8')]);
    expect(script).toContain('<!-- nightowl-evals-report -->');
    expect(script).toContain('format-report.mjs');
    expect(script).toMatch(/PATCH|issues\/comments/);
    expect(script).toContain('issues/${PR_NUMBER}/comments');
    // Conditional gate lives in action.yml — false skips the step entirely (no API).
    expect(yml).toContain("inputs.comment-on-pr == 'true'");
    expect(yml).toContain("github.event_name == 'pull_request'");
    expect(yml).toContain('github.event.pull_request.head.repo.full_name == github.repository');
    expect(yml).toContain('::warning::NightOwl sticky PR comment failed');
  });
});

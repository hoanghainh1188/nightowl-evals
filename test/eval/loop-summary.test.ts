import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formatEvalLoopLine, resolveEvalLoopSummary } from '../../src/eval/loop-summary.js';
import { createTempDir, type TempDir } from '../helpers/temp-repo.js';

const meta = (label: string | null, runAt: string, models: string[] = ['haiku']) =>
  JSON.stringify({ schema: 'nightowl.eval-run-meta/v1', label, models, run_at: runAt });

const row = (runAt: string, model: string, score: number, pass: boolean) =>
  JSON.stringify({
    run_at: runAt,
    case_id: 'c1',
    model,
    coverage: score,
    repeat: 0,
    score,
    pass,
    tests_passed: null,
    error: null,
  });

describe('eval loop summary', () => {
  let dir: TempDir;
  beforeEach(async () => {
    dir = await createTempDir();
  });
  afterEach(() => dir.cleanup());

  it('returns none when runs dir is missing', async () => {
    const view = await resolveEvalLoopSummary(dir.path);
    expect(view).toEqual({ kind: 'none' });
    expect(formatEvalLoopLine(view)).toBe('Eval loop: none recorded');
  });

  it('summarizes latest-only run with label', async () => {
    const runs = join(dir.path, '.nightowl', 'runs');
    await mkdir(runs, { recursive: true });
    await writeFile(
      join(runs, 'a.jsonl'),
      `${meta('rules-v2', '2026-11-14T10:00:00.000Z')}\n${row('2026-11-14T10:00:00.000Z', 'haiku', 0.8, true)}\n`,
    );
    const view = await resolveEvalLoopSummary(dir.path);
    expect(view.kind).toBe('ok');
    if (view.kind !== 'ok') return;
    expect(view.label).toBe('rules-v2');
    expect(view.oneLine).toContain('rules-v2');
    expect(view.oneLine).toContain('haiku');
    expect(formatEvalLoopLine(view)).toContain('Eval loop:');
  });

  it('includes delta when a previous run exists', async () => {
    const runs = join(dir.path, '.nightowl', 'runs');
    await mkdir(runs, { recursive: true });
    await writeFile(
      join(runs, 'old.jsonl'),
      `${meta('base', '2026-11-01T00:00:00.000Z')}\n${row('2026-11-01T00:00:00.000Z', 'haiku', 0.5, false)}\n`,
    );
    await writeFile(
      join(runs, 'new.jsonl'),
      `${meta('prompt-v3', '2026-11-14T00:00:00.000Z')}\n${row('2026-11-14T00:00:00.000Z', 'haiku', 0.9, true)}\n`,
    );
    const view = await resolveEvalLoopSummary(dir.path);
    expect(view.kind).toBe('ok');
    if (view.kind !== 'ok') return;
    expect(view.label).toBe('prompt-v3');
    expect(view.baselineLabel).toBe('base');
    expect(view.oneLine).toContain('vs prior');
  });

  it('skips corrupt files and still uses a good run', async () => {
    const runs = join(dir.path, '.nightowl', 'runs');
    await mkdir(runs, { recursive: true });
    await writeFile(join(runs, 'bad.jsonl'), '{not json\n');
    await writeFile(
      join(runs, 'good.jsonl'),
      `${meta('ok', '2026-11-14T12:00:00.000Z')}\n${row('2026-11-14T12:00:00.000Z', 'haiku', 1, true)}\n`,
    );
    const view = await resolveEvalLoopSummary(dir.path);
    expect(view.kind).toBe('ok');
    if (view.kind !== 'ok') return;
    expect(view.label).toBe('ok');
  });
});

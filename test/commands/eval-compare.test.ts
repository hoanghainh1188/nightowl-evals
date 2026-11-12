import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createEvalCompareCommand } from '../../src/commands/eval-compare.js';
import { RUN_META_SCHEMA } from '../../src/eval/compare.js';
import { createFakeIo } from '../helpers/fake-io.js';
import { seed } from '../helpers/seed-failures.js';
import { createFakeRepo, type TempDir } from '../helpers/temp-repo.js';

describe('nightowl eval-compare', () => {
  let repo: TempDir;
  beforeEach(async () => {
    repo = await createFakeRepo();
    await seed(repo.path, []);
  });
  afterEach(() => repo.cleanup());

  async function writeRun(name: string, body: string): Promise<string> {
    const dir = join(repo.path, '.nightowl', 'runs');
    await mkdir(dir, { recursive: true });
    const path = join(dir, name);
    await writeFile(path, body);
    return path;
  }

  it('prints markdown table from --input', async () => {
    const input = await writeRun(
      'run.jsonl',
      [
        JSON.stringify({ schema: RUN_META_SCHEMA, label: 'rules-v2', models: ['haiku'], run_at: 't' }),
        JSON.stringify({
          run_at: 't',
          case_id: 'c1',
          model: 'haiku',
          coverage: 1,
          repeat: 0,
          score: 0.9,
          pass: true,
          tests_passed: null,
          error: null,
        }),
      ].join('\n') + '\n',
    );
    const fake = createFakeIo();
    const code = await createEvalCompareCommand({ cwd: () => repo.path }).run(['--input', input], fake.io);
    expect(code).toBe(0);
    expect(fake.out()).toContain('rules-v2');
    expect(fake.out()).toContain('haiku');
    expect(fake.out()).toContain('NightOwl eval A/B');
  });

  it('writes html without CDN and supports baseline deltas', async () => {
    const current = await writeRun(
      'cur.jsonl',
      JSON.stringify({
        run_at: 't',
        case_id: 'c1',
        model: 'haiku',
        coverage: 1,
        repeat: 0,
        score: 0.9,
        pass: true,
        tests_passed: null,
        error: null,
      }) + '\n',
    );
    const baseline = await writeRun(
      'base.jsonl',
      JSON.stringify({
        run_at: 't0',
        case_id: 'c1',
        model: 'haiku',
        coverage: 0.5,
        repeat: 0,
        score: 0.4,
        pass: false,
        tests_passed: null,
        error: null,
      }) + '\n',
    );
    const out = join(repo.path, '.nightowl', 'eval-compare.html');
    const fake = createFakeIo();
    const code = await createEvalCompareCommand({ cwd: () => repo.path }).run(
      ['--input', current, '--baseline', baseline, '--format', 'html', '-o', out],
      fake.io,
    );
    expect(code).toBe(0);
    const html = await readFile(out, 'utf8');
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('Delta');
    expect(html).not.toMatch(/https?:\/\//);
  });

  it('errors when --input is missing', async () => {
    const fake = createFakeIo();
    const code = await createEvalCompareCommand({ cwd: () => repo.path }).run([], fake.io);
    expect(code).toBe(1);
    expect(fake.err()).toMatch(/--input/);
  });
});

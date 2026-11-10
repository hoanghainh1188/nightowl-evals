import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installCursorHooks, mergeCursorHooks, uninstallCursorHooks } from '../../src/setup/cursor-hooks.js';
import {
  AGENT_CONFIGS,
  hasNightowlAgentMarker,
  installAgentConfig,
  mergeAgentConfig,
  mergeWindsurfHooks,
} from '../../src/setup/agent-config.js';
import { installSelectedAgents } from '../../src/setup/agents-install.js';
import { createFakeRepo, type TempDir } from '../helpers/temp-repo.js';

describe('cursor hooks setup', () => {
  let repo: TempDir;
  beforeEach(async () => {
    repo = await createFakeRepo();
  });
  afterEach(() => repo.cleanup());

  it('installs and uninstalls Cursor hooks idempotently', async () => {
    const first = await installCursorHooks(repo.path);
    expect(first.status).toBe('created');
    const second = await installCursorHooks(repo.path);
    expect(second.status).toBe('unchanged');
    const doc = JSON.parse(await readFile(join(repo.path, '.cursor/hooks.json'), 'utf8'));
    expect(doc.hooks.beforeSubmitPrompt).toHaveLength(1);
    expect(doc.hooks.afterFileEdit).toHaveLength(1);
    const removed = await uninstallCursorHooks(repo.path);
    expect(removed.status).toBe('removed');
  });

  it('merges without duplicating NightOwl entries', () => {
    const once = mergeCursorHooks(null);
    const twice = mergeCursorHooks(once.value);
    expect(twice.status).toBe('unchanged');
    expect(twice.added).toBe(0);
  });
});

describe('best-effort agent configs', () => {
  let repo: TempDir;
  beforeEach(async () => {
    repo = await createFakeRepo();
  });
  afterEach(() => repo.cleanup());

  it.each(AGENT_CONFIGS.map((s) => [s.id, s] as const))('init adds a NightOwl entry for %s', async (_id, spec) => {
    const result = await installAgentConfig(repo.path, spec);
    expect(result.status).toBe('created');
    const doc = JSON.parse(await readFile(join(repo.path, spec.file), 'utf8'));
    expect(hasNightowlAgentMarker(doc, spec.id)).toBe(true);
    const again = mergeAgentConfig(doc, spec.id);
    expect(again.added).toBe(false);
  });

  it('writes Windsurf hooks.json with event lists', () => {
    const merged = mergeWindsurfHooks(null);
    expect(merged.added).toBe(true);
    expect(merged.value.hooks).toMatchObject({
      pre_user_prompt: [expect.objectContaining({ nightowl: true })],
      post_file_edit: [expect.objectContaining({ nightowl: true })],
    });
  });

  it('does not write native hook files for manual agents; warns with wrap hint', async () => {
    const lines = await installSelectedAgents(repo.path, ['aider', 'copilot-workspace']);
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line.status).toBe('unchanged');
      expect(line.warning).toMatch(/nightowl log --agent/);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { PROMPTFOO_MARKER } from '../../src/export/formats.js';
import { toPromptfooYaml } from '../../src/export/promptfoo.js';
import type { FailureToExport } from '../../src/storage/failures.js';

const failure = (): FailureToExport => ({
  id: 3,
  createdAt: '2026-11-10T12:00:00.000Z',
  filePath: 'a.ts',
  commitSha: null,
  prompt: 'do it',
  aiContent: 'bad\n',
  finalContent: 'good\n',
  category: null,
  categoryReason: null,
  categoryConfidence: null,
  source: 'manual-fix',
  feedback: null,
});

describe('toPromptfooYaml', () => {
  it('emits marker, prompts, providers, and equals assert', () => {
    const yaml = toPromptfooYaml([{ failure: failure(), fileBefore: 'old\n' }]);
    expect(yaml.startsWith(PROMPTFOO_MARKER)).toBe(true);
    expect(yaml).toContain('prompts:');
    expect(yaml).toContain('providers:');
    expect(yaml).toContain('- echo');
    expect(yaml).toContain('tests:');
    expect(yaml).toContain('type: equals');
    expect(yaml).toContain('file_path: "a.ts"');
    expect(yaml).toContain('good');
    expect(yaml).not.toMatch(/https?:\/\//);
  });

  it('emits empty tests list when there are no failures', () => {
    const yaml = toPromptfooYaml([]);
    expect(yaml).toContain('tests:');
    expect(yaml).toContain('[]');
  });
});

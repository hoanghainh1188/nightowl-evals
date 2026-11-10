import { describe, expect, it } from 'vitest';
import {
  buildRulesBlock,
  hasCompleteRulesBlock,
  hasRulesMarker,
  upsertRulesBlock,
} from '../../src/rules/format.js';
import { RULES_MARKER, RULES_MARKER_END, RULES_MARKER_START } from '../../src/rules/types.js';

describe('rules marker block helpers', () => {
  const block = buildRulesBlock('# NightOwl suggested rules\n\nhello');

  it('builds a start/end block', () => {
    expect(block).toContain(RULES_MARKER_START);
    expect(block).toContain(RULES_MARKER_END);
    expect(hasCompleteRulesBlock(block)).toBe(true);
    expect(hasRulesMarker(block)).toBe(true);
  });

  it('appends a block when the file has no markers', () => {
    const result = upsertRulesBlock('# User rules\n\nKeep this.\n', block);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content.startsWith('# User rules')).toBe(true);
    expect(result.content).toContain('Keep this.');
    expect(result.content).toContain(RULES_MARKER_START);
    expect(result.content.indexOf('Keep this.')).toBeLessThan(result.content.indexOf(RULES_MARKER_START));
  });

  it('replaces an existing block idempotently', () => {
    const first = upsertRulesBlock('# Intro\n', block);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const nextBlock = buildRulesBlock('# NightOwl suggested rules\n\nupdated');
    const second = upsertRulesBlock(first.content, nextBlock);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.content).toContain('updated');
    expect(second.content).not.toContain('\nhello\n');
    expect(second.content).toContain('# Intro');
    expect(count(second.content, RULES_MARKER_START)).toBe(1);
    expect(count(second.content, RULES_MARKER_END)).toBe(1);
  });

  it('rejects mismatched markers without --force', () => {
    const broken = `${RULES_MARKER_START}\npartial\n`;
    const result = upsertRulesBlock(broken, block, false);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/mismatched/i);
  });

  it('recovers skewed markers with force when both bounds exist', () => {
    const skewed = `before\n${RULES_MARKER_START}\nold\n${RULES_MARKER_START}\nmid\n${RULES_MARKER_END}\nafter\n`;
    const result = upsertRulesBlock(skewed, block, true);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content).toContain('before');
    expect(result.content).toContain('after');
    expect(count(result.content, RULES_MARKER_START)).toBe(1);
  });

  it('treats legacy single marker as a NightOwl file marker', () => {
    expect(hasRulesMarker(`${RULES_MARKER}\n# old\n`)).toBe(true);
    expect(hasCompleteRulesBlock(`${RULES_MARKER}\n# old\n`)).toBe(false);
  });

  it('warns when force drops content after a legacy marker', () => {
    const legacy = `# Keep\n${RULES_MARKER}\nold\n# After\n`;
    const result = upsertRulesBlock(legacy, block, true);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warning).toMatch(/dropped/i);
    expect(result.content).toContain('# Keep');
    expect(result.content).not.toContain('# After');
  });

  it('reports inverted markers clearly when force cannot recover', () => {
    const inverted = `x\n${RULES_MARKER_END}\nmiddle\n${RULES_MARKER_START}\ny\n`;
    const result = upsertRulesBlock(inverted, block, true);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/end marker appears before start/i);
    expect(result.error).not.toMatch(/pass --force/i);
  });
});

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

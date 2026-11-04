import { readClaudeAnswer } from '../shared/claude-answer.js';

export const MAX_OUTPUT_BYTES = 512 * 1024;

export type GeneratedFile = { readonly ok: true; readonly content: string } | { readonly ok: false; readonly error: string };

export function parseGeneratedFile(stdout: string): GeneratedFile {
  const read = readClaudeAnswer(stdout, 'file content');
  if (!read.ok) return read;
  const { content } = read.answer;
  if (typeof content !== 'string') return { ok: false, error: 'missing content' };
  if (Buffer.byteLength(content) > MAX_OUTPUT_BYTES) return { ok: false, error: 'content is larger than 512 KB' };
  return { ok: true, content };
}

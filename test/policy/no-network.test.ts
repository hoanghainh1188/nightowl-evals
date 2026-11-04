import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import pkg from '../../package.json' with { type: 'json' };

const SRC_DIR = join(import.meta.dirname, '../../src');
const NETWORK_MODULES = ['net', 'http', 'https', 'http2', 'dgram', 'tls', 'dns'];
const NETWORK_IMPORT = new RegExp(
  `from\\s+['"](?:node:)?(?:${NETWORK_MODULES.join('|')})(?:/[^'"]*)?['"]|import\\(\\s*['"](?:node:)?(?:${NETWORK_MODULES.join('|')})`,
);
const FETCH_CALL = /\b(?:fetch|WebSocket|EventSource)\s*\(|new\s+(?:WebSocket|EventSource)\b/;

async function sourceFiles(dir: string): Promise<readonly string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => join(entry.parentPath, entry.name));
}

describe('no-network policy', () => {
  it('ships with no runtime dependencies', () => {
    const dependencies = (pkg as { dependencies?: Record<string, string> }).dependencies ?? {};
    expect(Object.keys(dependencies)).toEqual([]);
  });

  it('never imports a network module or calls fetch from src/', async () => {
    const files = await sourceFiles(SRC_DIR);
    expect(files.length).toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const file of files) {
      const text = await readFile(file, 'utf8');
      if (NETWORK_IMPORT.test(text) || FETCH_CALL.test(text)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it('only starts claude from src/classify/', async () => {
    const files = await sourceFiles(SRC_DIR);
    const offenders: string[] = [];
    for (const file of files) {
      const text = await readFile(file, 'utf8');
      if (/['"]claude['"]/.test(text) && /\bspawn\(|\bexec(?:File)?(?:Sync)?\(/.test(text) && !file.includes(`${join('src', 'classify')}`)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
    const runner = await readFile(join(SRC_DIR, 'classify/run-claude.ts'), 'utf8');
    expect(runner).toMatch(/spawn\('claude'/);
  });

  it('never starts claude from a hook command', async () => {
    const commandFiles = ['log.ts', 'precommit.ts', 'postcommit.ts', 'git-hook-command.ts'].map((f) => join(SRC_DIR, 'commands', f));
    const hookFiles = [...commandFiles, ...(await sourceFiles(join(SRC_DIR, 'hooks')))];
    for (const file of hookFiles) {
      const text = await readFile(file, 'utf8');
      expect(text, file).not.toMatch(/from\s+['"][^'"]*\/(?:classify|eval)\//);
    }
  });

  it('detects the patterns it is meant to block', () => {
    expect(NETWORK_IMPORT.test("import { request } from 'node:https';")).toBe(true);
    expect(NETWORK_IMPORT.test("import net from 'net';")).toBe(true);
    expect(NETWORK_IMPORT.test("await import('node:dgram')")).toBe(true);
    expect(FETCH_CALL.test('await fetch(url)')).toBe(true);
    expect(NETWORK_IMPORT.test("import { join } from 'node:path';")).toBe(false);
  });
});

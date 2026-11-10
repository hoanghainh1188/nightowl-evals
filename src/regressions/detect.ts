import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RegressionFramework } from './types.js';

export async function detectFramework(root: string): Promise<RegressionFramework> {
  try {
    const raw = await readFile(join(root, 'package.json'), 'utf8');
    const pkg = JSON.parse(raw) as {
      devDependencies?: Record<string, string>;
      dependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const scripts = Object.values(pkg.scripts ?? {}).join(' ');
    if (deps.vitest !== undefined || /\bvitest\b/.test(scripts)) return 'vitest';
    if (deps.jest !== undefined || deps['@jest/globals'] !== undefined || /\bjest\b/.test(scripts)) return 'jest';
  } catch {
    // No package.json or invalid JSON → stay on json fixtures only.
  }
  return 'json';
}

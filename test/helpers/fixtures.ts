import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(import.meta.dirname, '../fixtures/claude-code');

export type FixtureName =
  | 'user-prompt-submit'
  | 'post-tool-use-edit'
  | 'post-tool-use-write'
  | 'post-tool-use-multiedit'
  | 'post-tool-use-bash';

// Fixture JSON with every __ROOT__ replaced by the given project root.
export function hookFixture(name: FixtureName, root: string): string {
  return readFileSync(join(DIR, `${name}.json`), 'utf8').replaceAll('__ROOT__', root);
}

export function hookFixtureObject(name: FixtureName, root: string): Record<string, unknown> {
  return JSON.parse(hookFixture(name, root)) as Record<string, unknown>;
}

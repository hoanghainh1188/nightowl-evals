import { join } from 'node:path';
import { build } from 'tsup';
import { createTempDir } from './temp-repo.js';

const ROOT = join(import.meta.dirname, '../..');

// Bundles a TypeScript probe so a test can run it in a fresh `node` process.
export async function buildProbe(name: string): Promise<{ file: string; cleanup: () => Promise<void> }> {
  const dir = await createTempDir('nightowl-probe-');
  await build({
    entry: { [name]: join(ROOT, 'test/fixtures/probes', `${name}.ts`) },
    outDir: dir.path,
    format: ['esm'],
    platform: 'node',
    target: 'node22',
    silent: true,
    config: false,
    removeNodeProtocol: false,
  });
  return { file: join(dir.path, `${name}.js`), cleanup: dir.cleanup };
}

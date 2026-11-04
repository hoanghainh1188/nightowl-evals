import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { bin: 'src/bin.ts' },
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  // Keep `node:` prefixes: `node:sqlite` has no unprefixed alias.
  removeNodeProtocol: false,
  banner: { js: '#!/usr/bin/env node' },
});

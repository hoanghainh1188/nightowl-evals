// Opens a store in argv[2], writes argv[3] events tagged argv[4], then optionally emits a warning.
import { openStore } from '../../../src/storage/store.js';

const [cwd = process.cwd(), count = '0', tag = 'probe', warn = ''] = process.argv.slice(2);
const store = await openStore({ cwd });
for (let i = 0; i < Number(count); i += 1) {
  store.insertEvent({ source: 'claude-code', kind: 'edit', filePath: `${tag}.ts`, payload: { i } });
}
store.close();
if (warn) process.emitWarning(warn, 'DeprecationWarning');

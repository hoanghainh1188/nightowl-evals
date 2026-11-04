import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Isolate every git call in the test run from the developer's global and system config
// (hooksPath, commit signing, templates) so results are the same on any machine.
process.env.GIT_CONFIG_GLOBAL = '/dev/null';
process.env.GIT_CONFIG_NOSYSTEM = '1';
// Git also reads $XDG_CONFIG_HOME/git/ignore (default ~/.config/git/ignore); point it nowhere.
process.env.XDG_CONFIG_HOME = join(tmpdir(), 'nightowl-test-no-xdg-config');

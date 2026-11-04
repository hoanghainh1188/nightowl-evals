import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { errorMessage } from '../cli/errors.js';
import { printable } from '../shared/printable.js';
import { findProjectRoot } from '../storage/project-root.js';
import { DATA_DIR, DB_FILE, openStore, type Store } from '../storage/store.js';

const NOT_SET_UP = "NightOwl is not set up in this project. Run 'nightowl init' first.";

// Opens the database read-only, and only where `nightowl init` already created it, so read
// commands never create, migrate or change anything. Returns a message for the user otherwise.
export async function openExistingStore(cwd: string): Promise<Store | string> {
  const root = findProjectRoot(cwd);
  if (root === null) return printable(`no git repository found at or above ${cwd}`);
  if (!existsSync(join(root, DATA_DIR, DB_FILE))) return NOT_SET_UP;
  try {
    return await openStore({ cwd: root, readOnly: true });
  } catch (error) {
    return printable(errorMessage(error));
  }
}

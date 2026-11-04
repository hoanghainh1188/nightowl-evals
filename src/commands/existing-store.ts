import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { findProjectRoot } from '../storage/project-root.js';
import { DATA_DIR, openStore, type Store } from '../storage/store.js';

// Opens the store only where `nightowl init` already ran, so read commands never create
// .nightowl/. Returns an error message for the user otherwise.
export async function openExistingStore(cwd: string): Promise<Store | string> {
  const root = findProjectRoot(cwd);
  if (root === null) return `no git repository found at or above ${cwd}`;
  if (!existsSync(join(root, DATA_DIR))) return "NightOwl is not set up in this project. Run 'nightowl init' first.";
  return openStore({ cwd: root });
}

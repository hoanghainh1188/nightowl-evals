import { findProjectRoot } from '../storage/project-root.js';
import { loadNightowlConfig, type LoadConfigResult } from './load.js';

/** Load merged config for a CLI command; errors if outside a git repo when a file is needed. */
export async function loadConfigFromCwd(options: {
  readonly cwd: string;
  readonly configPath?: string;
}): Promise<LoadConfigResult | { readonly ok: false; readonly error: string }> {
  const root = findProjectRoot(options.cwd);
  if (root === null) {
    if (options.configPath !== undefined) {
      return { ok: false, error: `no git repository found at or above ${options.cwd}` };
    }
    return {
      ok: true,
      config: {},
      projectPath: null,
      localPath: null,
      projectPresent: false,
      localPresent: false,
    };
  }
  return loadNightowlConfig({
    root,
    cwd: options.cwd,
    ...(options.configPath === undefined ? {} : { configPath: options.configPath }),
  });
}

import { readFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { DATA_DIR } from '../storage/data-dir.js';
import {
  EMPTY_CONFIG,
  LOCAL_CONFIG_FILE,
  PROJECT_CONFIG_FILE,
  mergeConfigs,
  parseConfigValue,
  type NightowlConfig,
} from './schema.js';

export interface LoadConfigOptions {
  /** Git / project root. */
  readonly root: string;
  /** Override path for the project config file (absolute or relative to cwd). */
  readonly configPath?: string;
  /** Base for resolving relative --config paths (defaults to root). */
  readonly cwd?: string;
}

export interface LoadConfigOk {
  readonly ok: true;
  readonly config: NightowlConfig;
  readonly projectPath: string | null;
  readonly localPath: string | null;
  readonly projectPresent: boolean;
  readonly localPresent: boolean;
}

export interface LoadConfigErr {
  readonly ok: false;
  readonly error: string;
}

export type LoadConfigResult = LoadConfigOk | LoadConfigErr;

async function readJsonFile(path: string): Promise<{ present: false } | { present: true; raw: unknown } | { error: string }> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { present: false };
    return { error: `cannot read ${path}: ${(error as Error).message}` };
  }
  try {
    return { present: true, raw: JSON.parse(text) as unknown };
  } catch (error) {
    return { error: `invalid JSON in ${path}: ${(error as Error).message}` };
  }
}

function resolveProjectPath(options: LoadConfigOptions): string {
  if (options.configPath === undefined) return join(options.root, PROJECT_CONFIG_FILE);
  const base = options.cwd ?? options.root;
  return isAbsolute(options.configPath) ? options.configPath : resolve(base, options.configPath);
}

export function projectConfigPath(root: string): string {
  return join(root, PROJECT_CONFIG_FILE);
}

export function localConfigPath(root: string): string {
  return join(root, DATA_DIR, LOCAL_CONFIG_FILE);
}

/** Load project + local overlay configs and merge (local wins). Missing files → empty. */
export async function loadNightowlConfig(options: LoadConfigOptions): Promise<LoadConfigResult> {
  const projectPath = resolveProjectPath(options);
  const localPath = localConfigPath(options.root);

  const projectFile = await readJsonFile(projectPath);
  if ('error' in projectFile) return { ok: false, error: projectFile.error };
  if (!projectFile.present && options.configPath !== undefined) {
    return { ok: false, error: `config file not found: ${projectPath}` };
  }

  let project: NightowlConfig = EMPTY_CONFIG;
  if (projectFile.present) {
    const parsed = parseConfigValue(projectFile.raw, projectPath);
    if (typeof parsed === 'string') return { ok: false, error: parsed };
    project = parsed;
  }

  const localFile = await readJsonFile(localPath);
  if ('error' in localFile) return { ok: false, error: localFile.error };

  let local: NightowlConfig = EMPTY_CONFIG;
  if (localFile.present) {
    const parsed = parseConfigValue(localFile.raw, localPath);
    if (typeof parsed === 'string') return { ok: false, error: parsed };
    local = parsed;
  }

  return {
    ok: true,
    config: mergeConfigs(project, local),
    projectPath: projectFile.present ? projectPath : null,
    localPath: localFile.present ? localPath : null,
    projectPresent: projectFile.present,
    localPresent: localFile.present,
  };
}

/** Minimal project config content written by `nightowl init`. */
export const MINIMAL_PROJECT_CONFIG = `${JSON.stringify({ version: 1 }, null, 2)}\n`;

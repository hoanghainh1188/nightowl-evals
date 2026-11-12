import { access, readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { Workspace } from './types.js';

function normalizeRel(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+$/, '');
}

async function readJson(path: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as unknown;
  } catch {
    return null;
  }
}

function workspacesFromPackageJson(pkg: unknown): readonly string[] {
  if (typeof pkg !== 'object' || pkg === null) return [];
  const workspaces = (pkg as { workspaces?: unknown }).workspaces;
  if (Array.isArray(workspaces)) return workspaces.map(String);
  if (typeof workspaces === 'object' && workspaces !== null && Array.isArray((workspaces as { packages?: unknown }).packages)) {
    return ((workspaces as { packages: unknown[] }).packages).map(String);
  }
  return [];
}

/** Minimal pnpm-workspace.yaml: collect string entries under a top-level `packages:` list. */
export function parsePnpmWorkspaceYaml(text: string): readonly string[] {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let inPackages = false;
  for (const raw of lines) {
    const line = raw.replace(/#.*$/, '').trimEnd();
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    if (/^packages\s*:/.test(trimmed)) {
      inPackages = true;
      const inline = trimmed.replace(/^packages\s*:\s*/, '').trim();
      if (inline.startsWith('[') && inline.endsWith(']')) {
        for (const part of inline.slice(1, -1).split(',')) {
          const v = part.trim().replace(/^['"]|['"]$/g, '');
          if (v) out.push(v);
        }
        inPackages = false;
      }
      continue;
    }
    if (!inPackages) continue;
    if (/^[A-Za-z_][\w-]*\s*:/.test(trimmed) && !trimmed.startsWith('-')) {
      inPackages = false;
      continue;
    }
    const m = /^\-\s*(.+)$/.exec(trimmed);
    if (m) {
      out.push(m[1]!.trim().replace(/^['"]|['"]$/g, ''));
    }
  }
  return out;
}

async function expandGlob(root: string, pattern: string): Promise<readonly string[]> {
  const normalized = normalizeRel(pattern);
  if (!normalized.includes('*')) {
    try {
      if ((await stat(join(root, normalized))).isDirectory()) return [normalized];
    } catch {
      return [];
    }
    return [];
  }
  // Support `foo/*` and `foo/*/bar` one-segment wildcards only.
  const parts = normalized.split('/');
  const starAt = parts.indexOf('*');
  if (starAt < 0 || parts.includes('**')) return [];
  const prefix = parts.slice(0, starAt).join('/');
  const suffix = parts.slice(starAt + 1);
  const parent = prefix.length === 0 ? root : join(root, prefix);
  let entries: string[];
  try {
    entries = await readdir(parent);
  } catch {
    return [];
  }
  const hits: string[] = [];
  for (const name of entries) {
    if (name.startsWith('.')) continue;
    const rel = prefix.length === 0 ? name : `${prefix}/${name}`;
    const abs = join(root, rel);
    try {
      if (!(await stat(abs)).isDirectory()) continue;
    } catch {
      continue;
    }
    if (suffix.length === 0) {
      hits.push(rel);
      continue;
    }
    const child = await expandGlob(root, [rel, ...suffix].join('/'));
    hits.push(...child);
  }
  return hits;
}

async function packageName(root: string, rel: string): Promise<string | null> {
  const pkg = await readJson(join(root, rel, 'package.json'));
  if (typeof pkg !== 'object' || pkg === null) return null;
  const name = (pkg as { name?: unknown }).name;
  return typeof name === 'string' && name.length > 0 ? name : null;
}

/** True when package.json has non-empty workspace patterns or `pnpm-workspace.yaml` exists. */
export async function hasWorkspaceConfig(root: string): Promise<boolean> {
  const rootPkg = await readJson(join(root, 'package.json'));
  if (workspacesFromPackageJson(rootPkg).length > 0) return true;
  try {
    await access(join(root, 'pnpm-workspace.yaml'));
    return true;
  } catch {
    return false;
  }
}

/** Discover JS/TS workspace package roots under a git/project root. */
export async function discoverWorkspaces(root: string): Promise<readonly Workspace[]> {
  const patterns = new Set<string>();
  const rootPkg = await readJson(join(root, 'package.json'));
  for (const p of workspacesFromPackageJson(rootPkg)) patterns.add(p);

  try {
    const yaml = await readFile(join(root, 'pnpm-workspace.yaml'), 'utf8');
    for (const p of parsePnpmWorkspaceYaml(yaml)) patterns.add(p);
  } catch {
    // optional
  }

  if (patterns.size === 0) return [];

  const dirs = new Set<string>();
  for (const pattern of patterns) {
    for (const hit of await expandGlob(root, pattern)) dirs.add(normalizeRel(hit));
  }

  const workspaces: Workspace[] = [];
  for (const path of [...dirs].sort()) {
    workspaces.push({ path, name: await packageName(root, path) });
  }
  return Object.freeze(workspaces);
}

import type { AgentId } from '../agents/ids.js';
import { AGENT_IDS, isAgentId } from '../agents/ids.js';
import { AGENT_CONFIGS, installAgentConfig, uninstallAgentConfig } from './agent-config.js';
import { installCursorHooks, uninstallCursorHooks } from './cursor-hooks.js';
import type { FileChange } from './gitignore.js';

export type InstallableAgent = AgentId;

export function parseAgentsList(raw: string | undefined): InstallableAgent[] | string {
  if (raw === undefined || raw.trim() === '' || raw.trim() === 'all') return [...AGENT_IDS];
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return 'empty --agents list';
  const out: InstallableAgent[] = [];
  for (const part of parts) {
    if (!isAgentId(part)) return `unknown agent id: ${part}`;
    if (!out.includes(part)) out.push(part);
  }
  return out;
}

export interface AgentInstallLine {
  readonly file: string;
  readonly status: FileChange | 'removed' | 'updated' | 'unchanged';
  readonly detail: string;
  readonly warning?: string;
}

export async function installSelectedAgents(root: string, agents: readonly InstallableAgent[]): Promise<readonly AgentInstallLine[]> {
  const lines: AgentInstallLine[] = [];
  for (const agent of agents) {
    try {
      if (agent === 'claude-code') continue; // handled by Claude settings installer
      if (agent === 'cursor') {
        const result = await installCursorHooks(root);
        lines.push({
          file: result.file,
          status: result.status,
          detail:
            result.status === 'unchanged'
              ? 'NightOwl Cursor hooks already present'
              : `hooks: beforeSubmitPrompt, afterFileEdit` + (result.upgraded > 0 ? `; upgraded ${result.upgraded}` : ''),
        });
        continue;
      }
      const spec = AGENT_CONFIGS.find((s) => s.id === agent);
      if (spec === undefined) continue;
      const result = await installAgentConfig(root, spec);
      lines.push({
        file: result.file,
        status: result.status,
        detail: result.status === 'unchanged' ? 'NightOwl entry already present' : `added NightOwl ${agent} hook entry`,
      });
    } catch (error) {
      lines.push({
        file: agent,
        status: 'unchanged',
        detail: 'skipped',
        warning: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return lines;
}

export async function uninstallAllAgentHooks(root: string): Promise<readonly AgentInstallLine[]> {
  const lines: AgentInstallLine[] = [];
  try {
    const cursor = await uninstallCursorHooks(root);
    if (cursor.status !== 'unchanged') {
      lines.push({
        file: cursor.file,
        status: cursor.status,
        detail: cursor.status === 'removed' ? 'removed' : `removed ${cursor.removed} NightOwl hooks`,
      });
    }
  } catch (error) {
    lines.push({
      file: '.cursor/hooks.json',
      status: 'unchanged',
      detail: 'skipped',
      warning: error instanceof Error ? error.message : String(error),
    });
  }
  for (const spec of AGENT_CONFIGS) {
    try {
      const result = await uninstallAgentConfig(root, spec);
      if (result.status !== 'unchanged') {
        lines.push({ file: result.file, status: result.status, detail: result.status === 'removed' ? 'removed' : 'removed NightOwl entry' });
      }
    } catch (error) {
      lines.push({
        file: spec.file,
        status: 'unchanged',
        detail: 'skipped',
        warning: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return lines;
}

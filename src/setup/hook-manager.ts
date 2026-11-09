import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { hookLine } from './git-hook.js';

export type HookManagerKind = 'husky' | 'lefthook' | 'none';

export interface HookManagerInfo {
  readonly kind: HookManagerKind;
  readonly name: string;
  readonly configPath?: string;
  readonly getInstructions: (hookName: string, command: string) => string;
}

export const LEFTHOOK_CONFIG_FILES = [
  'lefthook.yml',
  'lefthook.yaml',
  '.lefthook.yml',
  '.lefthook.yaml',
] as const;

export function detectHookManager(
  root: string,
  coreHooksPath?: string | null,
): HookManagerInfo {
  // 1. Check for Husky: core.hooksPath includes '.husky' or directory '.husky' exists in root
  if ((coreHooksPath && coreHooksPath.includes('.husky')) || existsSync(join(root, '.husky'))) {
    return {
      kind: 'husky',
      name: 'Husky',
      configPath: '.husky',
      getInstructions: (hookName: string, command: string) => {
        const line = hookLine(command);
        return [
          `  Husky detected (.husky/). Add this line to .husky/${hookName}:`,
          `  ${line}`,
        ].join('\n');
      },
    };
  }

  // 2. Check for Lefthook: look for configuration files
  for (const file of LEFTHOOK_CONFIG_FILES) {
    if (existsSync(join(root, file))) {
      return {
        kind: 'lefthook',
        name: 'Lefthook',
        configPath: file,
        getInstructions: (hookName: string, command: string) => {
          return [
            `  Lefthook detected (${file}). Add this configuration to ${file}:`,
            `  ${hookName}:`,
            '    commands:',
            '      nightowl:',
            `        run: ${hookLine(command)}`,
          ].join('\n');
        },
      };
    }
  }

  return {
    kind: 'none',
    name: 'Git',
    getInstructions: (hookName: string, command: string) => {
      return `  Add this line to your ${hookName} hook yourself:\n  ${hookLine(command)}`;
    },
  };
}

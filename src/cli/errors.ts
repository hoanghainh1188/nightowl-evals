// Hook entry points: they must exit 0 and stay silent whatever happens.
export const HOOK_COMMANDS: ReadonlySet<string> = new Set(['log', 'precommit', 'postcommit']);

export function isHookCommand(name: string | undefined): boolean {
  return name !== undefined && HOOK_COMMANDS.has(name);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

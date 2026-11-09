// Shared nightowl log invocation for every agent hook installer.
export const HOOK_COMMAND_LINE = 'command -v nightowl >/dev/null 2>&1 && nightowl log >/dev/null 2>&1 || true';
export const LEGACY_HOOK_COMMAND = 'nightowl log';

export function isNightowlCommand(command: unknown): boolean {
  return command === HOOK_COMMAND_LINE || command === LEGACY_HOOK_COMMAND;
}

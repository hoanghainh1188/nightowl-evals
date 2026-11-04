// The hook entry point: it must exit 0 and stay silent whatever happens.
export const HOOK_COMMAND = 'log';

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

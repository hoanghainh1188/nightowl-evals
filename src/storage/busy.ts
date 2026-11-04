const SQLITE_BUSY = 5;
const RETRY_DELAY_MS = 25;

export function isBusy(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'errcode' in error && error.errcode === SQLITE_BUSY;
}

// Switching a fresh database to WAL can fail with SQLITE_BUSY without waiting on
// busy_timeout when another process initialises it at the same moment, so retry.
export async function retryWhileBusy(step: () => void, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      step();
      return;
    } catch (error) {
      if (!isBusy(error) || Date.now() >= deadline) throw error;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}

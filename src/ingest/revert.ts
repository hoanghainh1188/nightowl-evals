const REVERT_SHA = /This reverts commit ([0-9a-f]{40})\b/i;

/** Returns the full 40-hex SHA of the reverted commit, or null if the message is not a standard git revert. */
export function parseRevertMessage(message: string): string | null {
  const match = REVERT_SHA.exec(message);
  return match?.[1]?.toLowerCase() ?? null;
}

/** Stable idempotency key for a (reverted, revert) commit pair. */
export function revertDedupeKey(revertedSha: string, revertSha: string): string {
  return `revert:${revertedSha.toLowerCase()}:${revertSha.toLowerCase()}`;
}

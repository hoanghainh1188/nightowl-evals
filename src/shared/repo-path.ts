/** Normalize a repo-relative path: `\` → `/`, strip leading `./` and trailing `/`. */
export function normalizeRepoPath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+$/, '');
}

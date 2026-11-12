export interface Workspace {
  /** Repo-relative path using `/` (no trailing slash), e.g. `packages/ui`. */
  readonly path: string;
  /** `package.json` name when present; otherwise null. */
  readonly name: string | null;
}

# Design

## Context

- `moduleOf(filePath, depth)` (`src/report/module.ts`) chỉ lấy N directory đầu — đủ cho single-package, yếu trên monorepo (`packages/ui/src/...` với depth 2 → `packages/ui` may coincidentally work, nhưng `apps/web/src/lib/x.ts` depth 2 → `apps/web` ok; depth 2 trên `packages/ui/src/components/Button.tsx` → `packages/ui` — often OK). Pain thật: depth 1 → mọi thứ `packages`/`apps`; hoặc nested `packages/foo/bar` packages; filter theo package name chưa có.
- Report / customer-report / dashboard / digest / clusters đều gọi `moduleOf` qua `buildReport` hoặc tương đương.
- Không có discovery workspace hiện tại.

## Goals / Non-Goals

**Goals:**

- Discover JS/TS workspaces local (`package.json#workspaces`, `pnpm-workspace.yaml`).
- Map file → nearest package root; stable label (`name` ưu tiên, fallback relative path).
- `--workspace <id>` filter trên report surfaces.
- Fallback depth khi không có workspace / path ngoài package.
- Windows path normalize to `/`.

**Non-Goals:**

- Multi-repo DB, Cargo/Go/Bazel MVP.
- Persist workspace map vào SQLite.
- New npm dependencies for YAML (minimal line parser for `pnpm-workspace.yaml` packages: globs only, or reuse existing if any).
- Changing hook/DB write path.

## Decisions

1. **Discovery module `src/workspace/`**
   - `discoverWorkspaces(root): Workspace[]` with `{ path, name }`.
   - Read root `package.json` workspaces (string[] or `{ packages: string[] }`); expand simple globs `*` one level (and `**` limited) via `fs` — no micromatch dependency; document supported glob subset.
   - Parse `pnpm-workspace.yaml` for `packages:` list (minimal YAML: lines under packages, strip quotes/comments).
   - For each package dir with `package.json`, read `name`.
   - **Alternative rejected:** shell out to `pnpm ls -r` — network/tool coupling.

2. **Labeling**
   - `moduleLabel(filePath, depth, workspaces)`:
     - If under a workspace root → use `name` if non-empty else relative path of root (e.g. `packages/ui`).
     - Else → existing `moduleOf(filePath, depth)`.
   - Clusters reuse same helper so report/dashboard stay consistent.

3. **`--workspace` matching**
   - Match against package `name` **or** relative root path (exact, case-sensitive as on disk for path; name as in package.json).
   - Repeatable flags = OR.
   - Unknown name → stderr error exit 1 (fail closed for typos).

4. **Where to filter**
   - Apply when building failure rows for report (before `buildReport`), same for dashboard/customer-report/digest inputs.
   - Do not filter checks/signals by workspace in MVP unless they carry file paths; document: workspace filter applies to failure-derived metrics; signals stay window-global or note n/a — **Decision: filter failures only; signals/check rates remain unscoped or drop from filtered view with note** — prefer: changedRate only from checks that… checks may not have package. **MVP: filter failures/modules/clusters; `changedRate`/`signals` stay full-window with a one-line note when `--workspace` set** OR recompute changedRate only if check events have paths. Checking quickly...

Actually commit-check events often have file paths. For simplicity in design: filter failure rows; leave check-based rates as full window unless easy to filter — document as limitation.

5. **Compatibility**
   - No workspace → identical to today.
   - Single package at repo root with only root package.json and no workspaces field → empty discovery → depth behavior.

## Risks / Trade-offs

- **Glob subset** incomplete for exotic workspace layouts — document; extend later.
- **Duplicate package names** in workspaces — match all / error; prefer error if ambiguous names for `--workspace name`.
- **YAML parser** fragility — keep minimal; tests for common pnpm files.
- **Performance** — discovery once per command invocation; cache in-memory.

## Migration Plan

- No DB migration.
- Not BREAKING for default (no `--workspace`, no workspaces file).
- Archive: tick #39 in `docs/v0.5-roadmap-ideas.md`.

## Open Questions

- Có cần `nightowl doctor` cảnh báo “workspace detected: N packages”? **Nice-to-have, không bắt buộc MVP.**

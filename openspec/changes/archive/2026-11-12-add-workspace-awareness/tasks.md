# Tasks

## 1. Discovery + labeling (TDD)

- [x] 1.1 Unit tests: discover from `package.json` workspaces / `pnpm-workspace.yaml`; map path → nearest package; empty when no workspace
- [x] 1.2 Module `src/workspace/` (discover + match filter + `moduleLabel` wrapping `moduleOf`)

## 2. Report surfaces

- [x] 2.1 Wire `report` / `customer-report` / `dashboard` / `digest`: `--workspace` (repeatable), unknown name → error; tests monorepo fixture
- [x] 2.2 `buildReport`/cluster module labels dùng `moduleLabel` khi có discovery; fallback depth không workspace
- [x] 2.3 Help + completion catalog + README

## 3. Validate

- [x] 3.1 `npm test` + typecheck + `openspec validate add-workspace-awareness` xanh
- [x] 3.2 Tick #39 khi archive

## Workflow follow-up

- Archive sau khi Harry duyệt apply và merge.
- Tick ideation #39 Done trong `docs/v0.5-roadmap-ideas.md`.

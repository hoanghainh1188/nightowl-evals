# Tasks

## 1. Config loader (TDD)

- [x] 1.1 Add unit tests for parse/merge/precedence (CLI > local > project > built-in), invalid JSON, unknown key, forbidden secret-ish keys, and missing files → empty defaults; verify they fail before implementation
- [x] 1.2 Implement `src/config/*` (paths `nightowl.config.json` + `.nightowl/config.local.json`, validate version 1, merge); verify unit tests pass
- [x] 1.3 Add `--config <path>` parsing helper + tests (override project file; relative path); verify invalid path/JSON exits with clear error

## 2. Doctor + init

- [x] 2.1 Wire doctor config check (missing both = pass/info; valid = pass; invalid = fail); verify doctor tests
- [x] 2.2 Init creates minimal `{ "version": 1 }` project config when absent and does not overwrite; verify init tests + `.nightowl/` still gitignored
- [x] 2.3 Update doctor/init help text; verify `--help` mentions config

## 3. Command wiring

- [x] 3.1 Wire `report` defaults (`failOnRate`, agents, workspaces) + help; verify CLI tests for config-driven fail-on-rate and CLI override
- [x] 3.2 Wire `digest` lookback/agents/workspaces from config; verify digest tests (no config → old default)
- [x] 3.3 Wire `prune` profile from config when no `--profile`/`--days`; verify prune dry-run tests
- [x] 3.4 Wire privacy `redactPaths` default for export/share-pack/dashboard/digest as specified; verify at least dashboard + share-pack flag-wins tests

## 4. Docs + completion + verify

- [x] 4.1 Document schema, precedence, and example in README; verify snippets match implemented keys
- [x] 4.2 Add `--config` to completion catalog for applicable commands; verify catalog/completion test
- [x] 4.3 Run `tsc`, focused config/doctor/report/digest/prune/privacy tests, full `npm test`, and `openspec validate add-local-config-profiles --strict`

## Workflow follow-up

- Archive change and tick #49 on `docs/v0.7-roadmap-ideas.md` after apply + review

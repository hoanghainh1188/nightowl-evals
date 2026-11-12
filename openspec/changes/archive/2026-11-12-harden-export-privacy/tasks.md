# Tasks

## 1. Privacy module

- [x] 1.1 Unit tests: redact secret/email; coarsen path; dry-run counters không chứa plaintext secret
- [x] 1.2 Module `src/privacy/` (extend patterns từ sensitive; `applyPrivacy` / `coarsenPath` / summarize)

## 2. Export wiring

- [x] 2.1 `nightowl export --redact-paths` và `--privacy-dry-run`; tests JSONL path coarsened / dry-run không ghi file
- [x] 2.2 Redact secret/email trên field text khi ghi export (kể cả không dry-run)

## 3. Report surfaces + docs

- [x] 3.1 `--redact-paths` trên customer-report / dashboard / digest; tests module/path coarsened khi bật
- [x] 3.2 Help + completion catalog + README; tick #37 khi archive
- [x] 3.3 `npm test` + typecheck + `openspec validate harden-export-privacy` xanh

## Workflow follow-up

- Archive sau khi Harry duyệt apply và merge.
- Tick ideation #37 Done trong `docs/v0.5-roadmap-ideas.md`.

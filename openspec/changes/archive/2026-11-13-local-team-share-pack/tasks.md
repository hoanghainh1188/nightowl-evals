# Tasks

## 1. Pack core

- [x] 1.1 Add `share-pack` command: open store, build report + digest for `--since`, apply default path redaction, write `report.md` / `digest.md` / `manifest.json` under output dir
- [x] 1.2 Default output under `.nightowl/share/<stamp>/`; support `-o/--output`; `--no-redact-paths`; reject missing store

## 2. Archive + surface

- [x] 2.1 Optional `--archive` writes local `.tar.gz` (Node zlib + small tar helper); no network
- [x] 2.2 Register command in index; help + README + completion flags

## 3. Verify

- [x] 3.1 Tests: pack contents, default redaction, no-redact flag, missing store, archive file exists
- [x] 3.2 `tsc`, focused share-pack tests, full `npm test`, `openspec validate local-team-share-pack --strict`

## Workflow follow-up

- Archive and tick #46 on `docs/v0.6-roadmap-ideas.md` after apply + review

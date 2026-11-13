# Tasks

## 1. Storage estimates + profiles

- [x] 1.1 Extend prune query/result with estimated snapshot bytes; keep count + failures-intact semantics
- [x] 1.2 Add retention profile map (`short`/`default`/`long` → days) and resolve with `--days` override rule from design

## 2. CLI output + vacuum size

- [x] 2.1 Print bytes on dry-run and real prune; skip VACUUM on dry-run+`--vacuum` with clear message
- [x] 2.2 On real `--vacuum`, report DB file bytes before/after; update help + README + completion `--profile`

## 3. Verify

- [x] 3.1 Tests: bytes estimate, profiles, days override, vacuum size / dry-run skip, help/completion
- [x] 3.2 `tsc`, focused prune tests, full `npm test`, `openspec validate improve-prune-ux --strict`

## Workflow follow-up

- Archive and tick #44 on `docs/v0.6-roadmap-ideas.md` after apply + review

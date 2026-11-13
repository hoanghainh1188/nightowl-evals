# Tasks

## 1. Indexes + timing helpers

- [x] 1.1 Append migration: indexes on `failures(created_at)`, `failures(agent, created_at)`, `checked_edits(check_id)`; tests migration + since semantics unchanged
- [x] 1.2 Add shared timing helper / budget constant for doctor + report debug

## 2. Doctor + report surface

- [x] 2.1 Doctor: measure sample report-read query; warn when over budget; update help
- [x] 2.2 `report --debug-timing` → stderr timings; stdout unchanged; completion + README

## 3. Verify

- [x] 3.1 Tests: migration indexes exist; doctor timing check; report debug-timing stderr vs JSON stdout
- [x] 3.2 `tsc`, focused storage/doctor/report tests, full `npm test`, `openspec validate large-db-performance --strict`

## Workflow follow-up

- Archive and tick #47 on `docs/v0.6-roadmap-ideas.md` after apply + review

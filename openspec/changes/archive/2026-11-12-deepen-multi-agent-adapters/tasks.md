# Tasks

## 1. Best-effort adapters + fixtures

- [x] 1.1 Add dedicated parsers for `windsurf`, `cline`, and `roo` (looksLike + parse); wire `detect.ts` to prefer them over shared generic hints for auto-detect
- [x] 1.2 Add/upgrade adapter tests with richer prompt+edit fixtures per best-effort agent; keep Claude/Cursor and manual forced/explicit cases green

## 2. Init / doctor shape checks

- [x] 2.1 Ensure `init` writes full documented contract fields for Windsurf events and Cline/Roo markers (idempotent; no empty/incomplete markers)
- [x] 2.2 Extend `doctor` to warn on parseable-but-incomplete best-effort config shapes; keep manual agents as manual-guidance only

## 3. Docs + verify

- [x] 3.1 Update README agent limitations and `init`/`doctor` help for deeper shape/maturity checks; decide windsurf maturity (keep best-effort unless verified bar met)
- [x] 3.2 Run `tsc`, focused agent/doctor tests, full `npm test`, and `openspec validate --change deepen-multi-agent-adapters --strict`

## Workflow follow-up

- Archive change and tick #43 on `docs/v0.6-roadmap-ideas.md` after apply + review

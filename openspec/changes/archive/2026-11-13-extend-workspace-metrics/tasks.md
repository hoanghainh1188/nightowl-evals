# Tasks

## 1. Checks query + filter

- [x] 1.1 Extend check report rows to include `filePath` when available (query/join); keep backward-compatible aggregation for unfiltered reports
- [x] 1.2 Apply workspace filter to path-bearing checks before `buildReport` / `changedRate`; leave no-`--workspace` behavior unchanged

## 2. Warn + docs

- [x] 2.1 When `--workspace` + `--fail-on-rate`, warn on stderr if checks lack path or scoped denominator is empty while full-window has checks
- [x] 2.2 Update `report --help` + README: scoped failures/changedRate vs full-window signals; note CI rate may change when combining flags

## 3. Verify

- [x] 3.1 Tests: workspace-scoped `changedRate`; unfiltered parity; warn path; help text
- [x] 3.2 `tsc`, focused report/workspace tests, full `npm test`, `openspec validate --change extend-workspace-metrics --strict`

## Workflow follow-up

- Archive and tick #45 on `docs/v0.6-roadmap-ideas.md` after apply + review

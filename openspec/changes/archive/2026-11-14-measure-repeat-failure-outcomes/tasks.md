# Tasks

## 1. Core metric (TDD)

- [x] 1.1 Add unit tests for repeat vs new / rate / dismissed / empty window (baseline + window fixtures) and verify they fail before implementation
- [x] 1.2 Implement pure helper (e.g. `src/report/repeat.ts` or `src/cluster/repeat.ts`) using `clusterKeyForFailure`; verify unit tests pass
- [x] 1.3 Implement default baseline window (same duration before `--since`) + explicit `--baseline-since` parsing helpers; verify edge tests (invalid date, no since → documented empty-baseline behavior)

## 2. Report surface

- [x] 2.1 Wire metric into `buildReport` / `formatJson` / `formatText` with additive `repeat` object; verify `test/report/format.test.ts` (and build tests) expect stable keys + unchanged `changed_rate`
- [x] 2.2 Add `report --baseline-since`, help text, completion catalog flag; verify CLI tests for JSON stderr-free happy path and invalid baseline exit 1
- [x] 2.3 Document briefly in README report options; verify help/`--help` mentions repeat/baseline

## 3. Digest + dashboard

- [x] 3.1 Compute repeat in digest pipeline and render Markdown/HTML line; verify digest build/format tests
- [x] 3.2 Surface repeat summary on dashboard HTML; verify dashboard format/command tests (null rate → n/a)

## 4. Integration verify

- [x] 4.1 Run `tsc`, focused report/digest/dashboard/cluster tests, full `npm test`, and `openspec validate measure-repeat-failure-outcomes --strict`

## Workflow follow-up

- Archive change and tick #48 on `docs/v0.7-roadmap-ideas.md` after apply + review

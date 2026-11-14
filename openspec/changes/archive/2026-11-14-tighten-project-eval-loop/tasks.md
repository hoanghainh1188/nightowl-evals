# Tasks

## 1. Loop hints (TDD)

- [x] 1.1 Add unit tests for `evalLoopNextStepsAfterExport` / `AfterSuggest` / `AfterEval` (contain `eval`, `--label`, `digest`/`dashboard`/`eval-compare` as designed); verify they fail before implementation
- [x] 1.2 Implement `src/eval/loop-hints.ts`; verify unit tests pass
- [x] 1.3 Wire hints into export (after successful file write), suggest-regressions (after write), and eval (after successful run save); verify command tests assert stderr “Next”

## 2. Eval-loop summary on digest/dashboard

- [x] 2.1 Add unit tests for `resolveEvalLoopSummary` / `formatEvalLoopLine` (none, latest-only, latest+previous delta, corrupt file → skip/na); verify they fail before implementation
- [x] 2.2 Implement `src/eval/loop-summary.ts` using existing run parse/aggregate helpers; verify unit tests
- [x] 2.3 Wire into digest + dashboard format/build; verify digest/dashboard tests for none and labeled run

## 3. Export --status + docs

- [x] 3.1 Add `--status` filter to export (default unchanged; `confirmed` only when passed); verify export tests
- [x] 3.2 Update help strings (export/eval/suggest-regressions/digest/dashboard) for the project eval loop; verify `--help` tests
- [x] 3.3 Document loop + privacy in README; add `--status` to completion catalog; verify catalog test
- [x] 3.4 Run `tsc`, focused eval/export/digest/dashboard tests, full `npm test`, and `openspec validate tighten-project-eval-loop --strict`

## Workflow follow-up

- Archive change and tick #51 on `docs/v0.7-roadmap-ideas.md` after apply + review

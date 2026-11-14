# Tasks

## 1. Heuristic classifier (TDD)

- [x] 1.1 Add unit tests for heuristic rules (whitespace/CRLF → convention; import-only → missing-context; rename → convention; prompt-mismatch hint → misread-requirement; no-match → null); verify they fail before implementation
- [x] 1.2 Implement `src/classify/heuristic.ts` (ordered first-match, `heuristic:<ruleId>`, confidence/reason); verify unit tests pass on macOS/Linux/Windows-safe string logic
- [x] 1.3 Cover edge cases (diff omitted / identical content / empty prompt) → null; verify tests

## 2. Classify --offline CLI

- [x] 2.1 Add failing CLI tests: `--offline` writes category without network/`--yes`; skips classified unless `--redo`; respects `--limit`; rejects `--offline --yes`; no-init error path unchanged
- [x] 2.2 Wire `--offline` in `classify` command (reuse `listFailuresToClassify` / `saveClassification`; no LLM lock; no model calls); verify CLI tests pass
- [x] 2.3 Update classify help/summary for offline vs LLM; verify `classify --help` mentions `--offline` and that LLM needs `--yes`

## 3. Report breakdown

- [x] 3.1 Add failing report tests for `by_classifier_source` (heuristic / llm / unclassified) in JSON + text summary; dismissed excluded like total
- [x] 3.2 Implement aggregation in report build/format from `classifier` prefix + null category; verify report tests pass

## 4. Docs + completion + verify

- [x] 4.1 Document offline-first flow and heuristic limits in README; verify commands match flags
- [x] 4.2 Add `--offline` to classify completion catalog; verify catalog/completion test
- [x] 4.3 Run `tsc`, focused classify/heuristic/report tests, full `npm test`, and `openspec validate improve-offline-classification --strict`

## Workflow follow-up

- Archive change and tick #50 on `docs/v0.7-roadmap-ideas.md` after apply + review

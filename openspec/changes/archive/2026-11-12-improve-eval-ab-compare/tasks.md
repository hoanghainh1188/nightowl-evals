# Tasks

## 1. Compare core (TDD)

- [x] 1.1 Unit tests: load run JSONL (+ optional meta); aggregate per model; delta vs baseline; disagreements ignore failed calls
- [x] 1.2 Module `src/eval/compare` (hoặc tương đương): parse/aggregate/delta + format Markdown/HTML self-contained (không CDN; không dump output code)

## 2. CLI wiring

- [x] 2.1 `nightowl eval-compare`: `--input`, `--baseline`, `--format md|html`, `-o/--output`; annotate rule-applied khi mở được store; tests command
- [x] 2.2 `nightowl eval --label` ghi metadata vào artifact runs; `--report` / baseline optional sau `--yes`; dry-run mô tả report; tests
- [x] 2.3 Registry + help `cli`; completion catalog; README

## 3. Validate

- [x] 3.1 `npm test` + typecheck + `openspec validate improve-eval-ab-compare` xanh
- [x] 3.2 Tick #38 khi archive

## Workflow follow-up

- Archive sau khi Harry duyệt apply và merge.
- Tick ideation #38 Done trong `docs/v0.5-roadmap-ideas.md`.

# Design

## Context

See proposal.md — Why. Đã có `export` → `.nightowl/export/evals.jsonl`, `eval --label` → `.nightowl/runs/*.jsonl` + metadata, `eval-compare` đọc baseline, và pattern UX `src/impact/loop-hints.ts` + `resolveRuleImpactSummary` trên digest/dashboard. Thiếu: next-step sau export/suggest/eval, và dòng eval-loop trên digest/dashboard. macOS/Linux/Windows: chỉ đọc file local UTF-8 dưới `.nightowl/`.

## Goals / Non-Goals

**Goals:**
- Hints “Next:” mirror rule-impact (stderr, offline).
- Một resolver tóm tắt eval-loop từ filesystem runs (không DB migration).
- Digest/dashboard wording ổn định, khớp nhau.
- `--status confirmed` trên export (opt-in filter, default giữ nguyên).

**Non-Goals:**
- Đổi scoring / schema eval JSONL.
- Auto-chọn baseline thông minh ngoài “run mới nhất vs run trước đó cùng models” đơn giản.
- Surface eval-loop lên customer-report / share-pack trong change này.

## Decisions

1. **Hints module `src/eval/loop-hints.ts`**
   - `evalLoopNextStepsAfterExport(suitePathShown)` → `eval --input … --label <id> --yes` + digest/dashboard.
   - `evalLoopNextStepsAfterSuggest()` → export hoặc eval trên fixture path đã document.
   - `evalLoopNextStepsAfterEval()` → `eval-compare --baseline <prev>` (nếu có) + digest/dashboard.
   - Wire vào export (sau ghi file, không dry-run privacy), suggest-regressions (sau write), eval (sau save results thành công).
   - **Alternatives:** chỉ README — không đủ đóng “thói quen tuần”.

2. **Resolver `src/eval/loop-summary.ts`**
   - Quét `.nightowl/runs/*.jsonl` (reuse `parseRunFile` / aggregate từ `eval/compare.ts`).
   - Chọn run mới nhất theo `run_at` (fallback mtime/filename stamp).
   - Baseline mặc định: run trước đó (cũ hơn) nếu parse được; không thì deltas = null, chỉ hiện stats run mới.
   - View: `{ kind: 'none' } | { kind: 'ok', label, baselineLabel, oneLine } | { kind: 'na', reason }`.
   - `formatEvalLoopLine(view)` dùng chung digest + dashboard (giống `formatRuleImpactLine`).
   - Lỗi đọc từng file → bỏ qua file đó; nếu không còn run hợp lệ → none; exception root → n/a.
   - **Alternatives:** ghi summary vào SQLite — overkill; không migration.

3. **Export `--status`**
   - `parseArgs` multi `--status confirmed|flagged` (và có thể dismissed excluded vẫn như nay).
   - Default: không filter status (mọi non-dismissed).
   - Document vòng: `review` confirm → `export --status confirmed`.

4. **Digest / dashboard wiring**
   - `buildDigest` / `dashboard` command: `resolveEvalLoopSummary(projectRoot)` song song rule-impact.
   - Format text/HTML thêm một dòng; không đổi sections khác.

5. **Docs / completion**
   - README: subsection “Project eval loop” cạnh Evaluation engine.
   - Help export/eval/suggest-regressions/digest/dashboard.
   - Catalog: `--status` trên export.

## Risks / Trade-offs

- **[Risk] Nhiều run cũ làm summary nhiễu** → Mitigation: chỉ latest + previous; document; không UI chọn run trong v1.
- **[Risk] Run JSONL hỏng** → Mitigation: skip + none/n/a; không crash digest.
- **[Risk] Hint stderr làm ồn CI** → Mitigation: một khối ngắn cố định; tests snapshot substring “Next:”.
- **[Risk] `--status` typo** → Mitigation: enum fail-closed như category filters khác.

## Migration Plan

1. loop-hints + tests → wire export/suggest/eval.
2. loop-summary + digest/dashboard + tests.
3. export `--status` + completion + README.
4. Rollback: bỏ hints/summary — hành vi eval cũ giữ; filter status bỏ là default cũ.

## Open Questions

- Có hiện eval-loop trên `report` text/JSON không — **không** trong change này (digest/dashboard đủ cho “thói quen tuần”).

# Design

## Context

See proposal.md — Why. Hiện `nightowl classify` chỉ có đường LLM (`--yes` + cli/api); dry-run không `--yes` không ghi DB. Cột `category` / `classifier` / `category_reason` / `category_confidence` / `classified_at` đã có — LLM ghi `classifier` dạng `claude-code:<model>` hoặc `anthropic-api:<model>`. `src/rules/heuristic.ts` chỉ phục vụ **suggest-rules**, không classify. Report đã có `byCategory` + `unclassified` nhưng chưa breakdown theo nguồn classifier.

## Goals / Non-Goals

**Goals:**
- Heuristic pure function, deterministic, zero network, zero deps mới.
- CLI `--offline` ghi DB an toàn; giữ dry-run LLM không BREAKING.
- Report đếm heuristic vs llm vs unclassified từ cột `classifier` hiện có.
- macOS / Linux / Windows: chỉ phụ thuộc nội dung file đã lưu trong DB (UTF-8), không shell.

**Non-Goals:**
- Auto-classify trong hook/`log`.
- Đổi bộ 4 category hoặc schema CHECK.
- ML/embeddings, remote rules sync, confidence calibration phức tạp.
- Đổi `rules/heuristic` suggest-rules (chỉ tái dùng tín hiệu nếu tiện, không merge module).

## Decisions

1. **Cờ CLI `--offline`**
   - `classify --offline` áp dụng heuristic, ghi DB, **không** cần `--yes`, **không** lấy classify lock LLM (không gọi model).
   - `classify` không `--offline` không `--yes` → dry-run LLM như hiện tại (DB không đổi).
   - `--offline` + `--yes` → lỗi rõ (mutex flags) hoặc ignore LLM; chọn **reject** để tránh ambiguity.
   - `--limit` / `--redo` dùng chung `listFailuresToClassify`.
   - **Alternatives:** đổi default `classify` thành ghi heuristic (**BREAKING** dry-run); subcommand `classify-offline`. Chọn flag để tương thích script dry-run.

2. **Module `src/classify/heuristic.ts` (tách khỏi rules)**
   - Input: `{ filePath, aiContent, finalContent, userPrompt?, feedback? }` (+ unifiedDiff đã có).
   - Output: `null` (no match) hoặc `{ category, reason, confidence, ruleId }`.
   - `classifier` lưu: `heuristic:<ruleId>` (ổn định, prefix `heuristic` để report group).
   - Rule v1 (ordered, first match wins) — conservative, ưu tiên precision:
     1. `whitespace-only` → `convention` (diff chỉ whitespace/CRLF sau normalize) — confidence ~0.9
     2. `import-or-path-only` → `missing-context` (chỉ đổi import/require/from path) — ~0.75
     3. `rename-identifier` → `convention` (đổi tên symbol/case, logic tokens ổn định thô) — ~0.7
     4. `prompt-mismatch-hint` → `misread-requirement` khi có userPrompt và final gần prompt hơn AI theo heuristic token overlap đơn giản — ~0.65
     5. else → no match (giữ unclassified)
   - Không đoán `logic` trừ khi có signal rất rõ trong follow-up; v1 chấp nhận để trống hơn gán sai.
   - **Alternatives:** luôn gán category thấp confidence; ML. Chọn fail-open unclassified.

3. **Không migration DB**
   - Tái dụng cột hiện có. Report: `classifier LIKE 'heuristic%'` → heuristic; `category IS NULL` → unclassified; còn lại có category → llm (hoặc `classifier` null legacy → coi llm/unknown đã document; prefer bucket `llm` nếu category non-null và không heuristic).

4. **Report surface**
   - `buildReport`: thêm `byClassifierSource: { heuristic, llm, unclassified }` (counts trên cùng rows đã aggregate, dismissed excluded như total).
   - Text: một dòng tóm tắt; JSON: khoá `by_classifier_source`.
   - Không bắt buộc digest/dashboard trong change này (proposal chỉ nêu report).

5. **Lock / init / hooks**
   - Offline: không `acquireClassifyLock` (ghi nhanh, conflict thấp; nếu cần serialize sau này dùng cùng lock — không v1).
   - Vẫn `openExistingStoreForWrite` / không tự init.
   - Hooks không gọi heuristic.

6. **Docs / completion**
   - Help + README: “chạy `classify --offline` trước; `--yes` khi cần LLM”.
   - Catalog thêm `--offline`.

## Risks / Trade-offs

- **[Risk] Gán sai category** → Mitigation: rule hẹp, no-match mặc định; confidence + reason; LLM `--redo` ghi đè; document giới hạn.
- **[Risk] `logic` ít được heuristic** → Mitigation: chấp nhận; report vẫn hiện unclassified; LLM opt-in cho phần còn lại.
- **[Risk] Phân biệt llm vs unknown classifier legacy** → Mitigation: mọi non-null category không prefix heuristic = `llm` bucket (đủ cho v1).
- **[Risk] Diff lớn / binary** → Mitigation: reuse truncate/diff omit hiện có; no-match nếu diff omitted.

## Migration Plan

1. Heuristic unit tests → implement rules → wire `--offline`.
2. Report breakdown + tests.
3. Help, completion, README.
4. Rollback: bỏ flag / không chạy `--offline` → hành vi cũ; dữ liệu heuristic vẫn hợp lệ category.

## Open Questions

- Có surface `by_classifier_source` lên digest/dashboard trong cùng PR không — **không** (giữ scope report); follow-up nếu cần.

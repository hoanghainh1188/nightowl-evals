# Design

## Context

- `nightowl eval` (`src/commands/eval.ts`) đã: dry-run mặc định; `--yes` gọi Claude Code; chấm textual; in bảng ASCII theo model + `differences()`; ghi JSONL per-row vào `.nightowl/runs/<stamp>-<hex>.jsonl` (fields: `run_at`, `case_id`, `model`, scores, tests, `error`).
- Chưa có: nhãn thí nghiệm, so sánh vs baseline file, xuất Markdown/HTML share-out, annotate rule-applied.
- Digest/dashboard đã có HTML self-contained + escape helpers — tái dùng pattern, không CDN.
- `rule-impact` đã có mark/show trên store; compare chỉ đọc annotate, không nhân bản logic cửa sổ failure.

## Goals / Non-Goals

**Goals:**

- Báo cáo A/B đọc được (MD/HTML) từ một run hoặc run vs baseline.
- Offline `eval-compare` không tốn thêm lời gọi model.
- `--label` trên eval để gắn thí nghiệm prompt/rules ở mức metadata.
- Chú thích rule-applied khi store có mark.
- Giữ JSONL runs + bảng text hiện có khi không chọn report file.

**Non-Goals:**

- Ma trận factorial prompt×rules×model trong một lệnh.
- Re-score / gọi LLM trong compare.
- Đổi công thức score hoặc `--test-command` semantics.
- Schema SQLite mới; SaaS; lộ developer PII; nhúng full model `output` vào HTML mặc định.

## Decisions

1. **Lệnh `eval-compare` + cờ trên `eval`**
   - Core logic trong module thuần (`src/eval/compare.ts` hoặc `src/eval-compare/`): load JSONL → aggregate per model → optional delta → format md/html.
   - `eval-compare` chỉ gọi module (offline).
   - `eval --report` / `-o` sau `--yes` gọi cùng module trên results vừa ghi (+ `--baseline` nếu có).
   - **Alternative rejected:** chỉ flag trên `eval` — khó tái chạy báo cáo từ file cũ không gọi model lại.

2. **Metadata run**
   - Thêm dòng đầu (hoặc file sidecar `.meta.json`) schema đã document, ví dụ `nightowl.eval-run-meta/v1` với `label`, `models`, `run_at`, `suite` path — để compare đọc label mà không phá parser dòng kết quả hiện có (bỏ qua dòng không phải result row / schema lạ giống eval loader).
   - **Alternative rejected:** chỉ encode label trong tên file — dễ vỡ, khó parse Windows.

3. **Baseline**
   - `--baseline <jsonl>` so khớp theo `model` (và intersection `case_id` khi tính bất đồng/delta passed). Model chỉ có ở một phía: hiện thị n/a, không bịa.
   - Mặc định không auto-pick “previous file” trong MVP (tránh bất ngờ); document có thể thêm sau.

4. **Format**
   - `md`: stdout mặc định; `-o` ghi file mode `0600`.
   - `html`: luôn ghi file (default `.nightowl/eval-compare.html` hoặc path `-o`); self-contained CSS tối giản kiểu digest.
   - Không dump `output` code vào HTML; link/path tới JSONL runs nếu cần.

5. **Rule-impact annotation**
   - `openExistingStore` read-only → latest mark label + `applied_at` một dòng; lỗi store → `n/a`. Không tính delta failure trong compare.

6. **Compatibility**
   - JSONL cũ không meta vẫn compare được (label absent).
   - Bảng ASCII stdout `eval` giữ khi không `--report`.

## Risks / Trade-offs

- **Schema meta mới** vs file cũ: parser phải bỏ qua/optional — mitigate bằng tests fixture cũ.
- **Baseline lệch tập case**: delta passed có thể misleading — document “intersection / per-model aggregates trên row có score”; tests nêu rõ.
- **HTML share-out** có thể chứa `case_id`/`file` gián tiếp qua id — ids hiện có thể encode path; mitigate: không in path tuyệt đối; tái dùng printable; optional coarsen ngoài scope (#37 đã có trên export/report khác).
- **Trùng logic summary** với `eval.ts`: extract shared helpers để tránh drift.

## Migration Plan

- Không migrate DB.
- Không **BREAKING** mặc định.
- Archive: tick #38 trong `docs/v0.5-roadmap-ideas.md`.

## Open Questions

- Có cần auto `--baseline` = run JSONL liền trước trong thư mục `runs/` không? **MVP: không** (chỉ đường dẫn tường minh).

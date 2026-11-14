# Proposal

## Why

Classification readiness ~85%: hầu hết failure còn `unclassified` vì `nightowl classify` chỉ chạy khi opt-in LLM (`--yes` / API key). Team nội bộ thường không bật mạng/LLM → report/cluster/rules thiếu category. Cần **heuristic offline mặc định** (không mạng) để lấp category an toàn, vẫn giữ LLM opt-in có thể bổ sung/ghi đè.

## What Changes

- Thêm **classify offline / heuristic** deterministic: gán một trong 4 category hiện có từ tín hiệu local (diff shape, path/module convention hints, pattern đã document) — **không gọi mạng, không cần `--yes`**.
- CLI: lệnh/cờ đã document (ví dụ `classify --offline` hoặc tương đương) áp dụng heuristic lên failure chưa có category (`--limit`/`--redo` khi áp dụng); dry-run LLM hiện tại (`classify` không `--yes`) **giữ hành vi preview** — không BREAKING semantics dry-run.
- LLM path (`--yes`, transport cli|api) **không đổi nguyên tắc**: tắt mặc định; MAY ghi đè kết quả heuristic khi `--redo` (hoặc cờ tương đương đã document); không ghi đè im lặng khi đã có category.
- Lưu nguồn phân loại rõ (`classifier` / metadata) để phân biệt `heuristic` vs LLM model.
- `report` (text + `--json`) bổ sung tóm tắt tỷ lệ / count theo nguồn: heuristic vs llm vs unclassified (trong cửa sổ lọc hiện có).
- Document README/`--help`: chạy offline trước; LLM chỉ khi cần.
- **Không BREAKING** schema category 4 loại; không đổi hook fail-open; không auto-gọi LLM.
- **Out of scope:** auto-classify trong hook/`log` (tránh side-effect mỗi commit — follow-up nếu cần), model ML tải về / embedding cloud, đổi bộ 4 category, SaaS labeling, gửi diff ra ngoài khi offline, dashboard team hosted, training trên dữ liệu user.

## Capabilities

### New Capabilities

- (none) — hành vi gắn vào `failure-classification` hiện có.

### Modified Capabilities

- `failure-classification`: Thêm đường offline/heuristic mặc định không mạng; hợp đồng với LLM (opt-in, override/`--redo`); lưu nguồn classifier; không gọi LLM từ offline path.
- `failure-report`: Report text/JSON gồm breakdown classified-by-heuristic vs llm vs unclassified.
- `cli`: Help/`classify --help` mô tả offline vs LLM, precedence, và rằng offline không cần `--yes`.
- `shell-completion`: Completion gợi ý cờ offline (và flag liên quan nếu thêm).

## Impact

- Code: module heuristic classify (tách khỏi `rules/heuristic` suggest-rules), wiring `src/commands/classify.ts`, có thể đọc lại `classifier` trong report build/format; tests unit + CLI; README.
- Storage: tái dùng cột `category` / `classifier` / `category_confidence` / `category_reason` hiện có — tránh migration trừ khi cần discriminator rõ hơn (chốt trong design).
- Dependencies: không thêm runtime dependency; không mạng trên offline path.
- Hard-rule: không exception (local-only, LLM off by default, không chấm người, hooks không classify).

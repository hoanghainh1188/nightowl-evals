# Proposal

## Why

Export / eval / eval-compare / suggest-regressions đã ship nhưng còn rời: sau `export` không có “bước tiếp theo”, digest/dashboard chưa hiện delta eval vs baseline, nên “so model có số” tuần khó thành thói quen. Cần **vòng local** (failure đã review → suite → eval/compare → tóm tắt digest/dashboard) giống pattern rule-impact hints hiện có.

## What Changes

- Document + CLI hints “Next:” sau `export` và `suggest-regressions` (khi ghi thành công): chạy `eval` (có `--label`), rồi `eval-compare` / `digest` / `dashboard` — **local, không mạng**.
- Sau `eval --yes` thành công: gợi ý `eval-compare` (khi có baseline) và/hoặc xem digest/dashboard.
- `digest` / `dashboard` thêm **một dòng/section eval-loop** ổn định: khi có run JSONL trong `.nightowl/runs/` (và baseline nếu có), nêu label + tóm tắt delta vs baseline (hoặc mean/pass của run mới nhất); khi chưa có run → none/n/a đã document. SHALL NOT lộ tên developer; SHALL NOT gọi mạng.
- Luồng đã document: ưu tiên failure `confirmed` (review) hoặc cluster → `export` / `suggest-regressions` → suite JSONL → `eval --label` → compare/digest. Có thể thêm filter `--status confirmed` trên export nếu chưa có (không BREAKING mặc định hiện tại).
- README/`--help` mô tả vòng eval project; giữ privacy khi xuất suite (redact/privacy flags hiện có).
- **Không BREAKING** schema `nightowl.eval/v1`, scoring, hay bắt buộc LLM.
- **Out of scope:** bịa test patch / auto-generate FAIL_TO_PASS không từ stub NightOwl; sync cloud run results; SaaS leaderboard; auto-push Slack/email; đổi scoring LLM; dashboard team hosted; auto-chạy eval trong hook.

## Capabilities

### New Capabilities

- `project-eval-loop`: Hợp đồng vòng failure → suite → eval/compare → surface digest/dashboard và next-step hints local-only.

### Modified Capabilities

- `eval-export`: Sau export thành công in next-step eval; tuỳ chọn lọc status confirmed (nếu thêm); help nêu vòng.
- `regression-synthesis`: Sau ghi suggest-regressions thành công in next-step (eval / export path đã document).
- `eval-run`: Sau eval thành công in next-step compare/digest; help nhấn `--label` trong vòng.
- `weekly-digest`: Dòng/tóm tắt eval-loop (delta vs baseline hoặc none).
- `local-dashboard`: Section/dòng eval-loop cùng semantics với digest.
- `cli`: Help chung/`--help` liên quan nêu vòng eval project local.
- `shell-completion`: Bổ sung flag mới nếu export thêm `--status` (hoặc tương đương).

## Impact

- Code: module hints kiểu `src/eval/loop-hints.ts` (mirror `impact/loop-hints`); resolver tóm tắt run từ `.nightowl/runs/`; wiring export / suggest-regressions / eval / digest / dashboard; README; tests.
- Storage: tái dùng file run JSONL + metadata label hiện có — tránh migration DB trừ khi design cần index (mặc định: đọc filesystem runs).
- Dependencies: không thêm runtime dependency; không mạng trên path hints/digest.
- Hard-rule: không exception (local-only, LLM opt-in cho eval, không chấm người, hooks không eval).

# Design

## Context

Có `suggest-rules` (heuristic/`--yes` LLM, ghi file đề xuất với marker) và `report` theo category/module/agent/week + CI gate. Chưa có chỗ ghi “đã áp rule vào dự án” hay so cửa sổ trước/sau. Roadmap #27 / proposal.md. Ràng buộc: offline mặc định; không telemetry; không chậm hook.

## Goals / Non-Goals

**Goals:**
- CLI: `rule-impact mark` + `rule-impact` (show/so sánh) — file-first, local SQLite.
- Baseline snapshot lúc mark; so before/after cùng độ dài cửa sổ.
- Text + `--json`; completion + help.

**Non-Goals:**
- Tự parse/diff `CLAUDE.md` / `.cursorrules` để suy “đã áp” (#29).
- Gắn impact vào `--fail-on-rate` hoặc sticky Action mặc định.
- Causal inference thống kê; chỉ đếm failure quan sát được.
- LLM giải thích “vì sao giảm”.

## Decisions

1. **Lệnh riêng `rule-impact`, không phình `report` mặc định**  
   Tránh phá CI gate / JSON schema Action đang phụ thuộc.  
   *Alternative:* cờ `--rule-impact` trên report — từ chối cho v1.

2. **Subcommands: `mark` và mặc định show**  
   - `nightowl rule-impact mark --label <id> [--category …] [--agent …] [--module …] [--at <ISO|YYYY-MM-DD>]`  
   - `nightowl rule-impact [--label <id>|--id <n>] [--before-days N] [--after-days N] [--json]`  
   Mặc định không args = show bản applied mới nhất. Show không có bản ghi → exit ≠ 0.

3. **Bảng `rule_applications` (migration +1), không nhồi vào `failures`**  
   Cột tối thiểu: `id`, `created_at`, `applied_at`, `label` UNIQUE (hoặc unique `(label, applied_at_day)`), `categories`/`agents`/`modules` TEXT JSON nullable, `baseline` TEXT JSON (`total`, `by_category`, …).  
   *Alternative:* event `kind=rule-applied` — được nhưng bảng riêng query rõ hơn cho list/show.

4. **Baseline = đếm failure non-dismissed khớp filter tại `applied_at` (created_at < applied_at hoặc ≤ — document `created_at < applied_at` cho “trước”, cửa sổ sau dùng `created_at >= applied_at`)**  
   Cửa sổ mặc định: `before-days = after-days = 14` (có thể override). Before: `[applied_at - D, applied_at)`; after: `[applied_at, applied_at + D)` cắt bởi “now” nếu after chưa đủ ngày (JSON nêu `after_incomplete: true`).

5. **Dedupe mark**  
   Cùng `--label` → `INSERT OR REPLACE` / upsert cập nhật `applied_at` + baseline mới, trừ khi `--force-new` tạo bản ghi thêm với suffix thời gian. Document: mặc định một label active (mới nhất theo `applied_at`).

6. **Filter module**  
   Dùng cùng `moduleOf(path, depth)` như report; mark nhận `--module <prefix>` và `--depth` (default 2) để khớp.

## Risks / Trade-offs

- [Cửa sổ after ngắn / ít data] → Mitigation: cờ `after_incomplete` + message; không claim “chứng minh” nhân quả.  
- [Label trùng ý khác filter] → Mitigation: baseline lưu filter; show in filter đã mark.  
- [Migration CHECK hẹp] → Mitigation: bảng mới, không đụng CHECK events/failures.  
- [Nhầm với #29 write rules] → Mitigation: mark chỉ metadata store; không sửa file rule dự án.

## Migration Plan

- Append migration tạo `rule_applications` (+ index `label`, `applied_at`).  
- Rollback: revert code; DB mới hơn → NightOwl cũ báo upgrade (hành vi sẵn có).

## Open Questions

- (Không chặn) Có list `rule-impact list` trong cùng change nếu tasks còn dư — quyết lúc apply.

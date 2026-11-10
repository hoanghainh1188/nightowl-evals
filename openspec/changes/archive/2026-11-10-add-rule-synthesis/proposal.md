# Proposal

## Why

NightOwl đã ghi lại lỗi AI bị dev sửa, nhưng tri thức đó vẫn nằm trong SQLite thay vì thành quy ước dự án. Cần lệnh biến các lỗi lặp (đặc biệt `convention` / `missing-context`) thành đề xuất rule để đưa vào `CLAUDE.md`, `.cursorrules` hoặc file quy tắc khác — giảm AI lặp cùng sai trong phiên sau.

## What Changes

- Thêm lệnh `nightowl suggest-rules` (alias/help có thể ghi `optimize-rules` nếu cần): đọc failure đã phân loại (ưu tiên `confirmed`), gom theo category / module / agent, và sinh bản nháp rule dạng Markdown.
- **Mặc định không gọi LLM** và không ghi đè file quy tắc dự án: in ra stdout (hoặc `--output`); chỉ ghi file đích khi người dùng chỉ định rõ (`--write <path>` hoặc tương đương) và xác nhận.
- Tuỳ chọn LLM opt-in (`--yes` + transport CLI/API giống `classify`) để diễn đạt rule mượt hơn từ cụm failure; heuristic/template luôn chạy được offline.
- Bộ lọc: `--since`, `--category`, `--agent`, `--status` (mặc định gồm `confirmed`, có thể gồm `flagged` khi chọn), `--limit` số cụm/rule.
- Không telemetry; không gửi failure ra mạng trừ khi user opt-in LLM.

## Capabilities

### New Capabilities

- `rule-synthesis`: tổng hợp failure thành đề xuất rule local (heuristic + LLM opt-in), xuất Markdown an toàn, không tự sửa file project trừ khi được chỉ định

### Modified Capabilities

- `cli`: đăng ký lệnh `suggest-rules` và help/flags liên quan

## Impact

- Lệnh mới dưới `src/commands/suggest-rules.ts` (+ module `src/rules/` hoặc tương đương), query SQLite hiện có, tái sử dụng pattern dry-run / `--yes` / transport của `classify`.
- Docs README: mục lệnh + ví dụ paste vào `CLAUDE.md` / Cursor rules.
- Không đổi schema SQLite bắt buộc cho v1 (đọc failure hiện có); không đụng hook git/agent.

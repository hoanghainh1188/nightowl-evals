# Proposal

## Why

NightOwl hiện chỉ bắt snapshot từ Claude Code, nên team dùng Cursor / Windsurf / Cline / Copilot / Aider không đo được lỗi AI trên cùng codebase, và không so được trợ lý nào cần sửa nhiều hơn. Cần mô hình đa agent đầy đủ: ingest từ nhiều tool, fallback git khi thiếu hook, và báo cáo đối đầu theo agent.

## What Changes

- Thêm lớp adapter chuẩn hoá prompt/edit từ **Cursor, Windsurf, Cline, Roo Code, GitHub Copilot Workspace, Aider** vào `nightowl log` (cùng fail-open như Claude Code).
- **BREAKING (schema):** mở rộng nguồn sự kiện / gắn `agent` trên events (và failures khi ghép) để phân biệt trợ lý; migration SQLite tự chạy qua `init`.
- `nightowl init` / `uninstall` cài và gỡ hook/config cho từng agent được hỗ trợ (mặc định personal; `--shared` khi áp dụng được).
- Thêm **git-based fallback**: khi commit có thay đổi file nhưng không có snapshot agent gần đây, ghi sự kiện/gắn cờ theo heuristic session branch hoặc “unknown-agent” để vẫn so được với bản commit (không bịa nội dung AI).
- `nightowl report` (và JSON) thêm nhóm **theo agent** và chỉ số đối đầu (tỷ lệ edit bị sửa / failure rate theo agent trong cửa sổ thời gian).
- Giữ Claude Code path hiện có; không telemetry; hook vẫn không chặn agent/git.

## Capabilities

### New Capabilities

- `agent-ingest`: chuẩn hoá và ghi sự kiện prompt/edit từ mọi agent được hỗ trợ qua `nightowl log` + cấu hình hook từng tool
- `git-agent-fallback`: gắn ngữ cảnh agent khi thiếu snapshot hook, dựa trên git (session branch / heuristic), không bịa nội dung AI

### Modified Capabilities

- `local-storage`: schema events/failures hỗ trợ nhiều agent (migration)
- `project-setup`: `init`/`uninstall` đăng ký và gỡ hook đa agent
- `failure-report`: báo cáo và JSON theo agent + so sánh đối đầu
- `failure-records`: ghép failure ưu tiên snapshot đúng agent của file
- `failure-review`: lọc `review` theo `--agent`
- `cli`: tuỳ chọn liên quan agent trên `init` / `report` / `log` nếu cần

## Impact

- `src/commands/log.ts`, `init`/`uninstall`, storage migrations, report builders, hooks setup cho `.cursor/`, và adapter modules mới.
- Docs README: bảng agent được hỗ trợ và giới hạn fallback.
- Không thêm dependency runtime nặng; ưu tiên Node built-in.
- Phạm vi lớn: triển khai theo phase trong tasks (nền tảng → Cursor → agents còn lại → fallback → report) nhưng **đủ điều kiện chấp nhận của cả roadmap C**.

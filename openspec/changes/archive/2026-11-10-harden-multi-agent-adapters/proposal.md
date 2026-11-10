# Proposal

## Why

Change 18 đã đăng ký đa agent, nhưng ngoài Claude Code và Cursor phần còn lại chủ yếu là JSON marker + `parseGenericAgent` — tool thật thường không đọc file đó, nên ingest/head-to-head thiếu dữ liệu. Cần làm cứng adapter và cấu hình theo contract từng agent (có fixture thật), đồng thời ghi rõ mức hỗ trợ để team không tưởng đã “cài xong”.

## What Changes

- Thay/ bổ sung **adapter parse riêng** (hoặc contract có fixture JSON thực tế) cho `windsurf`, `cline`, `roo`, `copilot-workspace`, `aider`; giữ Claude Code + Cursor không hồi quy.
- Nâng `init`/`uninstall`: với mỗi agent, ghi **định dạng cấu hình mà tool (hoặc wrapper đã document) thực sự dùng** khi biết được; nếu chỉ hỗ trợ manual wrap thì in cảnh báo + doc, không giả “hook native”.
- Thêm bảng **maturity** (verified / best-effort / manual) trong README và kiểm tra tương ứng trong `nightowl doctor` (có/không có file hook NightOwl theo agent đã chọn).
- Giữ fail-open, không telemetry, không chậm agent/git.
- **Không** mở rộng danh sách agent id mới trong change này (trừ khi design bắt buộc alias nội bộ).

## Capabilities

### New Capabilities

- (không có — harden hành vi hiện có)

### Modified Capabilities

- `agent-ingest`: yêu cầu adapter/fixture theo agent; phân biệt payload thật vs generic; từ chối giả định sai
- `project-setup`: `init`/`uninstall`/`doctor` phản ánh maturity và đường dẫn cấu hình thật (hoặc manual) từng agent
- `cli`: help/`doctor` mô tả kiểm tra đa agent và mức hỗ trợ

## Impact

- `src/agents/` (tách parser khỏi `generic.ts` khi cần), `src/setup/agent-config.ts` / installers, `src/commands/doctor.ts`, README bảng agent.
- Tests: fixture stdin từng agent ≥1 prompt + ≥1 edit (hoặc document “edit-only/prompt-only”).
- Không dependency runtime mới; không schema SQLite bắt buộc trừ khi design cần metadata maturity (ưu tiên tránh).

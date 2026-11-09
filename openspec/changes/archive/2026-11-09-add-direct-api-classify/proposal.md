# Proposal

## Why

`nightowl classify` hiện chỉ gọi qua `claude` CLI. Máy CI hoặc môi trường không cài Claude Code không phân loại được dù đã có API key. Cần đường vận chuyển opt-in gọi Anthropic Messages API trực tiếp, vẫn tắt mặc định và vẫn đòi `--yes`.

## What Changes

- Thêm tuỳ chọn transport cho `nightowl classify`: mặc định giữ CLI; với `--transport api` dùng HTTPS tới Anthropic API.
- Đọc API key từ biến môi trường (không ghi log, không lưu DB); thiếu key khi `--yes --transport api` thì báo lỗi rõ và thoát 1.
- Giữ nguyên schema phân loại, lock, limit, redo, cắt 20 KB; chỉ thay lớp gọi model.
- Dry-run nêu transport và (khi api) host sẽ gọi; không gửi request khi thiếu `--yes`.

## Capabilities

### New Capabilities

- (không có)

### Modified Capabilities

- `failure-classification`: cho phép phân loại qua Anthropic API khi người dùng opt-in `--transport api`

## Impact

- `src/commands/classify.ts`, module gọi API mới (ví dụ `src/classify/run-api.ts`), help/README, test classify.
- Dùng `fetch` của Node 22 — không thêm dependency npm.
- Khi bật API, dữ liệu failure **có** rời máy tới Anthropic (tương tự rủi ro của `claude` CLI); vẫn không có telemetry NightOwl riêng.

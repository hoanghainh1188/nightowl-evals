# Spec Delta

## ADDED Requirements

### Requirement: Mức hỗ trợ (maturity) theo agent
NightOwl SHALL gán mỗi agent id một mức hỗ trợ công khai: `verified` (hook/cấu hình tool đọc được + adapter có fixture), `best-effort` (parse được payload đã document nhưng cấu hình tool có thể cần bước thủ công), hoặc `manual` (chỉ document cách bọc gọi `nightowl log`). Claude Code và Cursor SHALL là `verified`.

#### Scenario: Tra cứu maturity
- **WHEN** người dùng xem README hoặc output `doctor` liên quan agent
- **THEN** mỗi agent trong registry có một mức `verified` | `best-effort` | `manual` nhất quán với implementation

### Requirement: Adapter có fixture cho agent ngoài Claude/Cursor
Với mỗi agent id khác `claude-code` và `cursor`, NightOwl SHALL có đường parse chuyên biệt hoặc contract có kiểm thử: ít nhất một fixture JSON đại diện sự kiện `prompt` và/hoặc `edit` (theo khả năng tool) dẫn tới sự kiện lưu đúng `agent` đó. SHALL NOT coi việc chỉ ghi file marker NightOwl là đủ để tuyên bố ingest native.

#### Scenario: Fixture Windsurf edit
- **WHEN** `nightowl log` nhận fixture Windsurf edit đã document
- **THEN** DB có sự kiện `edit` với `agent` là `windsurf` (hoặc thoát 0 không ghi nếu maturity là `manual` và fixture chỉ minh họa wrap — khi đó test document rõ không assert ghi DB từ hook native giả)

#### Scenario: Payload không khớp agent bị ép
- **WHEN** `--agent windsurf` nhưng stdin không phải JSON hợp lệ cho contract Windsurf
- **THEN** không ghi sự kiện giả; exit 0; có thể ghi error log nội bộ

## MODIFIED Requirements

### Requirement: Hỗ trợ đủ danh sách agent roadmap
NightOwl SHALL cung cấp, cho mỗi agent trong registry (`cursor`, `windsurf`, `cline`, `roo`, `copilot-workspace`, `aider` ngoài Claude Code): (1) đường ingest/`nightowl log` khớp maturity của agent, (2) hướng dẫn cấu hình (qua `init` và/hoặc README) đúng với cách tool hoặc wrapper thực sự nhận lệnh, và (3) không tuyên bố hook native nếu maturity là `manual`.

#### Scenario: init cài Cursor
- **WHEN** chạy `nightowl init` trên máy có quyền ghi `.cursor/`
- **THEN** cấu hình hook Cursor của NightOwl được thêm (idempotent) mà không xoá hook khác

#### Scenario: init agent manual
- **WHEN** chạy `nightowl init --agents <manual-agent>` với agent maturity `manual`
- **THEN** lệnh không giả tạo hook native;stdout/stderr có hướng dẫn wrap đã document; exit 0

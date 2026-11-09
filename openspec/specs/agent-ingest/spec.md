# agent-ingest Specification

## Purpose

Chuẩn hoá prompt và lần sửa file từ nhiều trợ lý AI thành sự kiện NightOwl local, không làm chậm hay chặn agent, để so sánh được với bản commit.

## Requirements

### Requirement: Agent id chuẩn
Mỗi sự kiện prompt/edit từ trợ lý AI SHALL mang `agent` thuộc tập cố định: `claude-code`, `cursor`, `windsurf`, `cline`, `roo`, `copilot-workspace`, `aider`. Giá trị khác SHALL bị từ chối hoặc bỏ qua an toàn (exit 0, không ghi).

#### Scenario: Cursor edit
- **WHEN** `nightowl log` nhận payload Cursor `afterFileEdit` hợp lệ
- **THEN** sự kiện `edit` được ghi với `agent` là `cursor`

#### Scenario: Agent không hỗ trợ
- **WHEN** payload khai báo agent `unknown-bot`
- **THEN** không ghi DB; lệnh thoát 0

### Requirement: nightowl log nhận nhiều định dạng hook
`nightowl log` SHALL nhận JSON stdin từ hook Claude Code (như hiện tại) **và** từ adapter các agent khác, rồi quy về cùng mô hình sự kiện `prompt` / `edit` (session id, đường dẫn tương đối, nội dung file hoặc diff đủ để snapshot).

#### Scenario: Cursor afterFileEdit
- **WHEN** stdin là JSON Cursor `afterFileEdit` với `file_path` trong repo
- **THEN** NightOwl đọc file trên đĩa (hoặc áp edits) và lưu snapshot edit như với Claude Code

#### Scenario: Cursor beforeSubmitPrompt
- **WHEN** stdin là JSON Cursor có prompt người dùng
- **THEN** lưu sự kiện `prompt` với session/conversation id Cursor

### Requirement: Fail-open và giới hạn thời gian
Mọi đường ingest agent SHALL thoát mã 0 với Claude/Cursor/…, không in stderr làm dừng agent, và bỏ cuộc trong giới hạn thời gian hiện có của hook (không chậm vòng agent).

#### Scenario: File không đọc được
- **WHEN** hook edit trỏ file không đọc được
- **THEN** không ném lỗi ra agent; có thể ghi error log nội bộ; exit 0

### Requirement: Hỗ trợ đủ danh sách agent roadmap
NightOwl SHALL cung cấp adapter + hướng dẫn cấu hình hook (qua `init` hoặc doc đi kèm adapter) cho: Cursor, Windsurf, Cline, Roo Code, GitHub Copilot Workspace, Aider, ngoài Claude Code đã có.

#### Scenario: init cài Cursor
- **WHEN** chạy `nightowl init` trên máy có quyền ghi `.cursor/`
- **THEN** cấu hình hook Cursor của NightOwl được thêm (idempotent) mà không xoá hook khác

## ADDED Requirements

### Requirement: init đăng ký hook đa agent
`nightowl init` SHALL cài cấu hình ingest cho Claude Code (như hiện tại) và cho các agent hỗ trợ có thể cấu hình trên máy (ít nhất Cursor qua `.cursor/hooks.json` personal hoặc shared tương đương). Cài đặt SHALL idempotent, không xoá hook của người dùng khác.

#### Scenario: init thêm Cursor hooks
- **WHEN** chạy `nightowl init` trong repo chưa có NightOwl Cursor hooks
- **THEN** `.cursor/hooks.json` (hoặc file đích đã document) chứa lệnh gọi `nightowl log` cho prompt/edit; exit 0

#### Scenario: chạy lại init
- **WHEN** chạy `nightowl init` lần hai
- **THEN** không nhân đôi hook NightOwl

### Requirement: uninstall gỡ hook đa agent
`nightowl uninstall` SHALL gỡ hook NightOwl đã cài cho mọi agent nó quản lý, giữ nguyên hook không phải NightOwl.

#### Scenario: uninstall Cursor
- **WHEN** đã init Cursor hooks rồi chạy `nightowl uninstall`
- **THEN** lệnh NightOwl biến mất khỏi cấu hình Cursor; hook khác còn lại

### Requirement: Tuỳ chọn chọn agent khi init
`nightowl init` SHALL chấp nhận `--agents <list>` (hoặc tương đương) để chọn subset; mặc định cài mọi agent hỗ trợ có thể ghi cấu hình. Agent không áp dụng được trên OS/môi trường SHALL bị bỏ qua kèm cảnh báo, không fail cả lệnh.

#### Scenario: chỉ Cursor
- **WHEN** `nightowl init --agents cursor`
- **THEN** cài Cursor + git hooks; không bắt buộc đụng Windsurf/Cline nếu không chọn

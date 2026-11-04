# Proposal

## Why

Đây là change đầu tiên thu dữ liệu thật: mỗi lần Claude Code sửa file, NightOwl lưu lại AI đã viết gì và theo prompt nào. Không có dữ liệu này thì change 4 (git hook) không có gì để so với code dev commit, và mục tiêu 50 lỗi thật của giai đoạn 1 không bắt đầu được.

## What Changes

- `nightowl init` (hết là lệnh rỗng):
  - thêm `.nightowl/` vào `.gitignore` của dự án;
  - ghi hook vào `.claude/settings.json`, gộp với cấu hình có sẵn, chạy nhiều lần không bị trùng.
- Hook được đăng ký:
  - `PostToolUse` với matcher `Edit|Write|MultiEdit` → `nightowl log`;
  - `UserPromptSubmit` → `nightowl log`, để lưu prompt (bảng change trong doc chỉ ghi PostToolUse, nhưng mục tiêu MVP tuần 1 là "ghi prompt + code AI sinh ra", mà payload PostToolUse không chứa prompt).
- `nightowl log` (hết là lệnh chỉ đọc rồi bỏ): đọc JSON của hook từ stdin, ghi một sự kiện vào database (change 2):
  - prompt → sự kiện `prompt`;
  - Edit/Write/MultiEdit → sự kiện `edit`, kèm thay đổi AI định làm và **ảnh chụp toàn bộ nội dung file ngay sau khi AI sửa**. Change 4 dùng ảnh chụp này để so với bản dev commit.
- Lỗi trong hook chỉ ghi vào `.nightowl/nightowl.log`; `log` vẫn im lặng và thoát 0.
- Giới hạn kích thước: bỏ qua ảnh chụp file quá lớn, cắt prompt quá dài, bỏ qua file nằm ngoài dự án hoặc trong `.git/`, `.nightowl/`.

Ngoài phạm vi: git hook và việc `init` cài git hook (change 4), gỡ cài đặt (`uninstall`), Cursor hay agent khác.

## Capabilities

### New Capabilities

- `project-setup`: Lệnh `nightowl init`: chuẩn bị một dự án để NightOwl ghi dữ liệu (`.gitignore`, cấu hình hook). Change 4 thêm phần cài git hook vào đây.
- `claude-code-hook`: Nhận sự kiện từ hook của Claude Code qua `nightowl log` và lưu thành sự kiện trong database.

### Modified Capabilities

- `cli`: `init` không còn nằm trong danh sách lệnh chưa triển khai.

## Impact

- Code: `src/commands/init.ts`, `src/commands/log.ts`, thư mục mới `src/setup/` và `src/hooks/claude-code/`.
- Ghi vào file của dự án đích: `.gitignore`, `.claude/settings.json`, `.nightowl/`.
- Phụ thuộc change 2 (`add-local-storage`).
- `.claude/settings.json` thường được commit. Nếu cả team dùng chung repo, máy nào chưa cài `nightowl` sẽ thấy Claude Code báo hook lỗi (không chặn công việc). Giai đoạn 1 chỉ có một người dùng nên chấp nhận được; xem design mục 2.

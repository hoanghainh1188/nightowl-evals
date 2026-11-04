# Spec Delta

## Purpose

Biến mỗi sự kiện hook của Claude Code (prompt, lần sửa file) thành một sự kiện lưu local, đủ để sau này so code AI viết với code dev commit, mà không bao giờ làm chậm hay chặn Claude Code.

## ADDED Requirements

### Requirement: Lưu prompt
Khi nhận payload `UserPromptSubmit`, `nightowl log` SHALL lưu một sự kiện nguồn `claude-code`, loại `prompt`, kèm id phiên và nội dung prompt.

#### Scenario: Người dùng gửi prompt
- **WHEN** payload `{"hook_event_name":"UserPromptSubmit","session_id":"s1","cwd":"<repo>","prompt":"thêm validate email"}` được pipe vào `nightowl log`
- **THEN** database có một sự kiện `prompt` với `session_id` `s1` và prompt `thêm validate email`

### Requirement: Lưu lần AI sửa file
Khi nhận payload `PostToolUse` của `Edit`, `Write` hoặc `MultiEdit`, `nightowl log` SHALL lưu một sự kiện loại `edit` gồm id phiên, tên tool, đường dẫn file tương đối so với gốc dự án, phần thay đổi trong `tool_input`, và nội dung đầy đủ của file đọc từ đĩa lúc hook chạy.

#### Scenario: AI dùng Edit
- **WHEN** payload `PostToolUse` của `Edit` cho file `<repo>/src/a.ts` được pipe vào `nightowl log`
- **THEN** database có một sự kiện `edit` với `file_path` `src/a.ts`, có `old_string`, `new_string`, và nội dung file hiện tại trên đĩa

#### Scenario: Tool khác
- **WHEN** payload `PostToolUse` của `Bash` được pipe vào `nightowl log`
- **THEN** không có sự kiện nào được ghi

### Requirement: Chỉ lưu file thuộc dự án
`nightowl log` SHALL NOT lưu sự kiện `edit` cho file nằm ngoài gốc dự án hoặc nằm trong `.git/` hay `.nightowl/`.

#### Scenario: File ngoài dự án
- **WHEN** AI sửa `/etc/hosts` hoặc `~/.claude/settings.json`
- **THEN** không có sự kiện nào được ghi

### Requirement: Không lưu nội dung file nhạy cảm
Với file có tên thuộc nhóm bí mật (ví dụ `.env*`, `*.pem`, `*.key`, `id_rsa`, `.npmrc`, `credentials`, `secrets.*`) hoặc file bị git bỏ qua theo `.gitignore`, `nightowl log` SHALL lưu sự kiện `edit` chỉ với đường dẫn và lý do bỏ qua (`sensitive` hoặc `ignored`), SHALL NOT lưu nội dung file hay phần thay đổi.

#### Scenario: AI sửa .env
- **WHEN** AI dùng Edit đổi `API_KEY` trong `.env`
- **THEN** sự kiện `edit` có `snapshot_skipped` bằng `sensitive` và database không chứa giá trị của khoá

#### Scenario: File bị .gitignore bỏ qua
- **WHEN** AI ghi `build/out.js` và `.gitignore` có `build/`
- **THEN** sự kiện `edit` có `snapshot_skipped` bằng `ignored` và không có nội dung file

### Requirement: Giới hạn kích thước
`nightowl log` SHALL cắt prompt dài hơn 64 KB và SHALL bỏ ảnh chụp nội dung file lớn hơn 512 KB (vẫn lưu sự kiện, đánh dấu ảnh chụp bị bỏ). Trường bị cắt hoặc bỏ SHALL được đánh dấu trong payload.

#### Scenario: File rất lớn
- **WHEN** AI dùng Write tạo một file 2 MB
- **THEN** sự kiện `edit` được lưu không kèm nội dung file, và payload đánh dấu `snapshot_skipped`

### Requirement: Lỗi chỉ ghi vào log file
Khi payload không đọc được, stdin không đóng kịp, thiếu trường, hoặc ghi database thất bại, `nightowl log` SHALL thêm một dòng mô tả lỗi (không kèm nội dung code hay prompt, đường dẫn thư mục home thay bằng `~`) vào `.nightowl/nightowl.log` nếu tìm được gốc dự án, và vẫn im lặng, thoát mã 0. File log SHALL không vượt quá 1 MB.

#### Scenario: Payload hỏng trong repo
- **WHEN** chuỗi `not json` được pipe vào `nightowl log` trong một repo git
- **THEN** mã thoát 0, stdout và stderr rỗng, `.nightowl/nightowl.log` có một dòng lỗi

#### Scenario: stdin không đóng kịp
- **WHEN** stdin chưa gửi EOF khi hết thời gian chờ
- **THEN** sự kiện bị bỏ và `.nightowl/nightowl.log` ghi rõ lý do là stdin không đóng kịp, khác với lỗi payload hỏng

### Requirement: Hook nhanh
`nightowl log` SHALL ghi xong và thoát trong vòng 1 giây với payload hợp lệ tới 1 MB trên máy phát triển thông thường.

#### Scenario: Payload Write 1 MB
- **WHEN** payload `Write` 1 MB được pipe vào `nightowl log`
- **THEN** lệnh thoát mã 0 trong vòng 1 giây

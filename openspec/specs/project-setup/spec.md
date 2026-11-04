# project-setup Specification

## Purpose
Lệnh `nightowl init` chuẩn bị một dự án để NightOwl tự ghi dữ liệu: bỏ dữ liệu khỏi git và đăng ký hook, an toàn khi chạy lại và không phá cấu hình người dùng đã có.

## Requirements

### Requirement: init chỉ chạy trong repo git
`nightowl init` SHALL chạy ở gốc của repo git chứa thư mục làm việc. Khi không có repo git, lệnh SHALL báo lỗi ra stderr, không tạo file nào, và thoát mã 1.

#### Scenario: Ngoài repo git
- **WHEN** chạy `nightowl init` ở thư mục không thuộc repo git
- **THEN** stderr báo không tìm thấy repo git, không file nào được tạo, mã thoát 1

#### Scenario: Chạy từ thư mục con
- **WHEN** chạy `nightowl init` trong `<repo>/src`
- **THEN** mọi file được tạo hoặc sửa nằm ở `<repo>`, không phải `<repo>/src`

### Requirement: Bỏ dữ liệu NightOwl khỏi git
`nightowl init` SHALL đảm bảo `.gitignore` ở gốc repo có dòng `.nightowl/`, tạo file nếu chưa có, giữ nguyên mọi dòng khác, và không thêm trùng.

#### Scenario: Chưa có .gitignore
- **WHEN** chạy `nightowl init` trong repo chưa có `.gitignore`
- **THEN** `.gitignore` được tạo và chứa dòng `.nightowl/`

#### Scenario: Đã có dòng
- **WHEN** `.gitignore` đã có `.nightowl/` và chạy `nightowl init`
- **THEN** `.gitignore` không đổi

### Requirement: Đăng ký hook Claude Code
`nightowl init` SHALL thêm vào `.claude/settings.json` một hook `PostToolUse` matcher `Edit|Write|MultiEdit` và một hook `UserPromptSubmit`, cả hai chạy `nightowl log`. Mọi khoá và hook khác có sẵn SHALL được giữ nguyên.

#### Scenario: Chưa có settings.json
- **WHEN** chạy `nightowl init` trong repo chưa có `.claude/settings.json`
- **THEN** file được tạo, là JSON hợp lệ, chứa hai hook trên

#### Scenario: Gộp với cấu hình có sẵn
- **WHEN** `.claude/settings.json` đã có `permissions` và một hook `PostToolUse` khác, rồi chạy `nightowl init`
- **THEN** `permissions` và hook cũ còn nguyên, hai hook của NightOwl được thêm vào

#### Scenario: settings.json hỏng
- **WHEN** `.claude/settings.json` không phải JSON hợp lệ
- **THEN** lệnh không sửa file, stderr nêu đường dẫn file và lỗi, mã thoát 1

### Requirement: init chạy lại được
Chạy `nightowl init` nhiều lần SHALL cho cùng kết quả như chạy một lần: không trùng hook, không trùng dòng `.gitignore`.

#### Scenario: Chạy hai lần
- **WHEN** chạy `nightowl init` hai lần liên tiếp
- **THEN** sau lần thứ hai, `.gitignore` và `.claude/settings.json` giống hệt sau lần thứ nhất

### Requirement: Báo kết quả
`nightowl init` SHALL in ra stdout danh sách file đã tạo hoặc sửa (hoặc báo đã cài sẵn) và thoát mã 0. Khi lệnh `nightowl` không có trong `PATH`, SHALL in thêm cảnh báo ra stderr rằng hook sẽ không chạy được.

#### Scenario: nightowl không có trong PATH
- **WHEN** chạy `nightowl init` qua `npx` trên máy chưa cài `nightowl` toàn cục
- **THEN** cài đặt vẫn hoàn tất, mã thoát 0, stderr có cảnh báo kèm cách cài (`npm i -g @hoanghainh/nightowl-evals`)

### Requirement: Cài git hook pre-commit
`nightowl init` SHALL đảm bảo hook `pre-commit` của repo gọi `nightowl precommit` theo cách không bao giờ làm commit thất bại. Hook chưa có SHALL được tạo mới và cho phép thực thi. Hook shell có sẵn SHALL được giữ nguyên nội dung, chỉ thêm dòng gọi NightOwl ngay sau dòng shebang. Chạy lại `init` SHALL không thêm trùng.

#### Scenario: Chưa có hook
- **WHEN** chạy `nightowl init` trong repo chưa có `.git/hooks/pre-commit`
- **THEN** file được tạo, có quyền thực thi, và gọi `nightowl precommit`

#### Scenario: Đã có hook shell khác
- **WHEN** `.git/hooks/pre-commit` là script `sh` chạy `npm run lint`, rồi chạy `nightowl init`
- **THEN** hook vẫn chạy `npm run lint` như cũ và có thêm dòng gọi `nightowl precommit`

#### Scenario: Chạy init hai lần
- **WHEN** chạy `nightowl init` hai lần
- **THEN** hook chỉ có một dòng gọi `nightowl precommit`

#### Scenario: nightowl bị gỡ khỏi máy
- **WHEN** hook đã cài nhưng lệnh `nightowl` không còn trong `PATH`, và dev chạy `git commit`
- **THEN** commit thành công như không có NightOwl

### Requirement: Không sửa hook do công cụ khác quản lý
Khi repo đặt `core.hooksPath`, hoặc hook `pre-commit` có sẵn không phải script shell, `nightowl init` SHALL NOT sửa file hook nào, và SHALL in ra stderr dòng lệnh cần tự thêm vào hook `pre-commit`, rồi thoát mã 0.

#### Scenario: Repo dùng husky
- **WHEN** `core.hooksPath` là `.husky` và chạy `nightowl init`
- **THEN** không file nào trong `.husky/` bị sửa, stderr có hướng dẫn thêm dòng gọi `nightowl precommit`, mã thoát 0

#### Scenario: Hook viết bằng Node
- **WHEN** `.git/hooks/pre-commit` bắt đầu bằng `#!/usr/bin/env node`
- **THEN** file không bị sửa và stderr có hướng dẫn thêm dòng gọi

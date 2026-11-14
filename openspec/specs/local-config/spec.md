# local-config Specification

## Purpose

Định nghĩa file cấu hình NightOwl local (project commit được + overlay máy) để team chia sẻ defaults an toàn trên nhiều máy mà không sync cloud hay chứa secret.

## Requirements

### Requirement: Vị trí file config đã document
NightOwl SHALL tìm **project config** tại đường dẫn đã document ở root repo git (ví dụ `nightowl.config.json`) và MAY đọc **local overlay** dưới `.nightowl/` (đã gitignore). Khi không có file nào, hành vi SHALL giống built-in defaults hiện tại. Config SHALL NOT được tải từ mạng.

#### Scenario: Không có file config
- **WHEN** chạy lệnh hỗ trợ config trong repo không có project config lẫn overlay
- **THEN** lệnh dùng built-in defaults như trước change; thoát theo semantics lệnh (không bắt buộc có config)

#### Scenario: Chỉ có project config
- **WHEN** tồn tại project config hợp lệ và không có overlay
- **THEN** defaults từ project config được áp dụng cho flag chưa truyền

### Requirement: Merge và precedence
Khi cả project config và local overlay tồn tại, overlay SHALL ghi đè key trùng của project. Flag CLI tường minh SHALL ghi đè mọi giá trị config cho cùng tuỳ chọn. Thứ tự precedence SHALL là: CLI > local overlay > project config > built-in.

#### Scenario: Flag CLI thắng config
- **WHEN** project config đặt `failOnRate` (hoặc khoá đã document) và người dùng truyền `--fail-on-rate` khác
- **THEN** lệnh dùng giá trị từ CLI

#### Scenario: Overlay thắng project
- **WHEN** project và overlay cùng khoá với giá trị khác nhau và không có flag CLI
- **THEN** lệnh dùng giá trị overlay

### Requirement: Validate schema và từ chối secret class
Config SHALL là JSON object với `version` số nguyên đã hỗ trợ (v1). Giá trị không hợp lệ (kiểu sai, enum lạ, số ngoài range đã document) SHALL làm lệnh dùng config thoát ≠ 0 với stderr rõ và SHALL NOT ghi DB chỉ vì lỗi parse. Project/overlay mẫu và tài liệu SHALL NOT khuyến khích lưu API key, token, hoặc mật khẩu; nếu khoá cấm đã document xuất hiện, validate SHALL fail.

#### Scenario: JSON hỏng
- **WHEN** project config không phải JSON hợp lệ
- **THEN** lệnh đọc config thoát ≠ 0; stderr nêu file và lỗi parse

#### Scenario: Khoá cấm
- **WHEN** config chứa khoá dạng secret đã document (ví dụ `apiKey`, `token`)
- **THEN** validate fail; thoát ≠ 0; không dùng phần còn lại như defaults im lặng

### Requirement: Tập defaults v1 đã document
Config v1 SHALL hỗ trợ ít nhất các nhóm defaults đã document: CI/report gate (`failOnRate`), filters (`agents`, `workspaces`), digest window, prune `profile`, và privacy `redactPaths` (boolean) cho lệnh export/share/dashboard/digest khi áp dụng. Khoá không nhận diện MAY bị ignore với cảnh báo stderr hoặc fail theo chế độ đã document (chọn một và ổn định — mặc định: fail trên unknown key ở v1 để tránh typo âm thầm).

#### Scenario: Unknown key
- **WHEN** config v1 chứa khoá không thuộc schema
- **THEN** validate fail với tên khoá trên stderr

#### Scenario: Defaults prune profile
- **WHEN** config đặt prune profile hợp lệ và chạy `prune` không `--profile`/`--days`
- **THEN** prune dùng profile từ config

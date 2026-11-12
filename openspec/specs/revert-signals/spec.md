# revert-signals Specification

## Purpose

Phát hiện commit git revert (hoặc tương đương đã document) của commit từng gắn failure NightOwl, ghi tín hiệu local idempotent, liên kết failure gốc khi suy ra được, không bịa `ai_content` và không gọi mạng.

## Requirements

### Requirement: Lệnh ingest-revert
`nightowl ingest-revert` (hoặc tên tương đương đã document) SHALL quét lịch sử git local trong cửa sổ đã document (ví dụ `--since`, mặc định hợp lý), tìm commit revert khớp SHA đã lưu trên failure/checks NightOwl, ghi sự kiện kind `revert` vào store dự án, rồi thoát 0 khi thành công. Lệnh SHALL NOT tạo DB nếu chưa init (stderr hướng dẫn, thoát ≠ 0). SHALL NOT gọi mạng.

#### Scenario: Revert khớp failure.commit_sha
- **WHEN** store có failure với `commit_sha` = `A` và git có commit revert chuẩn của `A`, rồi chạy ingest-revert
- **THEN** store có ≥1 sự kiện `revert`; payload gồm SHA bị revert và SHA commit revert; thoát 0

#### Scenario: Chưa init
- **WHEN** chạy ingest-revert trong repo chưa có `.nightowl/nightowl.db`
- **THEN** không tạo DB; stderr hướng dẫn init; thoát ≠ 0

### Requirement: Không bịa ai_content
Ingest revert SHALL NOT chèn hàng `failures` với `ai_content` bịa. Khi tìm thấy failure gốc, sự kiện SHALL liên kết `failure_id` (hoặc tương đương) trong payload. Tạo failure phụ MAY chỉ khi tái dùng nội dung đã có từ failure gốc và đã document; mặc định MVP MAY chỉ ghi event.

#### Scenario: Không có failure khớp
- **WHEN** git có revert nhưng không có failure/check NightOwl cho SHA đó
- **THEN** không bắt buộc ghi sự kiện (hoặc ghi với liên kết null theo design); không tạo failure với nội dung giả

### Requirement: Fail-open với lịch sử git thiếu
Khi không đọc được git, message không parse được, hoặc lịch sử bị squash/rewrite khiến không khớp SHA, lệnh SHALL NOT crash process git hook (nếu được gọi từ hook): thoát 0 hoặc bỏ qua có log. CLI MAY thoát ≠ 0 chỉ khi lỗi cấu hình rõ (chưa init, không phải git repo).

#### Scenario: Không phải git repo
- **WHEN** chạy trong thư mục không phải git working tree
- **THEN** stderr báo rõ; thoát ≠ 0 cho CLI; không ghi event giả

### Requirement: Idempotent theo khóa revert
Ingest lặp cùng cặp (reverted_sha, revert_commit_sha) SHALL NOT nhân bản sự kiện vô hạn; dùng `dedupe_key` (hoặc tương đương) ổn định đã document.

#### Scenario: Chạy hai lần
- **WHEN** ingest-revert hai lần trên cùng lịch sử không đổi
- **THEN** số sự kiện `revert` cho cùng dedupe không tăng gấp đôi sau lần hai

### Requirement: Document giới hạn
Help/README SHALL nêu giới hạn: squash merge, rewrite history, cherry-pick, revert thủ công không theo message chuẩn có thể không phát hiện được.

#### Scenario: Help nêu giới hạn
- **WHEN** chạy `nightowl ingest-revert --help`
- **THEN** mô tả gồm ít nhất một giới hạn đã liệt kê ở trên

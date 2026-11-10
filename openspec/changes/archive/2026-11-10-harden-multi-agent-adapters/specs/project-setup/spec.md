# Spec Delta

## ADDED Requirements

### Requirement: init tôn trọng maturity khi cài agent
Khi cài agent có maturity `verified` hoặc `best-effort` với đường cấu hình đã biết, `nightowl init` SHALL ghi đúng định dạng file/tool đã document (idempotent). Khi maturity là `manual`, init SHALL NOT ghi file giả “hook native” như thể tool sẽ đọc; SHALL in hướng dẫn cấu hình thủ công.

#### Scenario: init verified Cursor không đổi hành vi
- **WHEN** `nightowl init --agents cursor`
- **THEN** `.cursor/hooks.json` vẫn nhận NightOwl hooks như hiện tại

#### Scenario: init manual không tạo hook giả
- **WHEN** `nightowl init --agents` gồm một agent `manual`
- **THEN** không tạo file cấu hình tuyên bố sai là hook native của tool đó; có cảnh báo/hướng dẫn

### Requirement: doctor kiểm tra hook đa agent
`nightowl doctor` SHALL kiểm tra sự hiện diện cấu hình NightOwl cho các agent `verified`/`best-effort` đã document (ít nhất Cursor ngoài Claude Code). Thiếu cấu hình SHALL là cảnh báo (exit 0 trừ `--strict`). Agent `manual` SHALL được liệt kê là cần cấu hình thủ công, không fail như thiếu hook native.

#### Scenario: thiếu Cursor hooks
- **WHEN** repo đã init git/Claude nhưng thiếu NightOwl trong `.cursor/hooks.json` và chạy `nightowl doctor`
- **THEN** có cảnh báo Cursor/agent hooks; exit 0 (hoặc 1 với `--strict`)

#### Scenario: agent manual trong doctor
- **WHEN** chạy `doctor` và registry có agent `manual`
- **THEN** output nêu agent đó cần setup thủ công, không báo “hook file missing” như verified

## MODIFIED Requirements

### Requirement: Chẩn đoán môi trường và cấu hình
`nightowl doctor` SHALL kiểm tra Node.js (>= 22.13.0, `node:sqlite`), Git repo, cấu hình hook Claude Code, cấu hình ingest đa agent theo maturity (Cursor và các agent verified/best-effort đã document), Git hooks (`pre-commit`, `post-commit` hoặc hook manager), cùng `.nightowl/` và database SQLite. Lệnh SHALL in kết quả ra stdout. Khi gặp lỗi nghiêm trọng (Node không hợp lệ, ngoài Git repo, database hỏng), lệnh SHALL thoát mã 1. Khi môi trường sẵn sàng hoặc chỉ có cảnh báo, lệnh SHALL thoát mã 0.

#### Scenario: Chẩn đoán trên dự án đầy đủ hợp lệ
- **WHEN** chạy `nightowl doctor` trong repo đã cài đặt đầy đủ hook, Node >= 22.13 và SQLite toàn vẹn
- **THEN** stdout hiển thị trạng thái hợp lệ cho các nhóm kiểm tra (gồm Claude và agent verified đã cài) và lệnh thoát mã 0

#### Scenario: Chẩn đoán khi dùng hook manager
- **WHEN** chạy `nightowl doctor` trong repo dùng Husky hoặc Lefthook đã cấu hình gọi NightOwl
- **THEN** nhóm kiểm tra Git hooks nhận diện đúng hook manager tương ứng và báo cáo hợp lệ

#### Scenario: Chẩn đoán trong dự án chưa khởi tạo
- **WHEN** chạy `nightowl doctor` trong repo git chưa chạy `nightowl init`
- **THEN** stdout cảnh báo các hook chưa được cài đặt và gợi ý chạy `nightowl init`, lệnh thoát mã 0

#### Scenario: Chẩn đoán khi Node.js không tương thích
- **WHEN** chạy `nightowl doctor` trên phiên bản Node.js thấp hơn 22.13.0
- **THEN** stdout/stderr báo lỗi Node.js không tương thích và lệnh thoát mã 1

#### Scenario: Chẩn đoán khi ngoài Git repo
- **WHEN** chạy `nightowl doctor` tại thư mục không thuộc git repository
- **THEN** lệnh báo lỗi không tìm thấy git repository và thoát mã 1

#### Scenario: Chẩn đoán khi database bị hỏng
- **WHEN** file `.nightowl/nightowl.db` bị hỏng hoặc không vượt qua kiểm tra toàn vẹn
- **THEN** lệnh báo lỗi kiểm tra database thất bại và thoát mã 1

#### Scenario: Cờ --strict khi có cảnh báo
- **WHEN** chạy `nightowl doctor --strict` và có ít nhất một cảnh báo (ví dụ chưa cài hook)
- **THEN** lệnh thoát mã 1

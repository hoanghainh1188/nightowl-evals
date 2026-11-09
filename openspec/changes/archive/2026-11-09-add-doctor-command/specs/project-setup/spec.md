# Spec Delta: project-setup

## ADDED Requirements

### Requirement: Chẩn đoán môi trường và cấu hình
`nightowl doctor` SHALL kiểm tra Node.js (>= 22.13.0, `node:sqlite`), Git repo, cấu hình hook Claude Code, Git hooks (`pre-commit`, `post-commit`), cùng thư mục `.nightowl/` và database SQLite. Lệnh SHALL in kết quả chẩn đoán ra stdout. Khi gặp lỗi nghiêm trọng (Node không hợp lệ, ngoài Git repo, database hỏng), lệnh SHALL thoát mã 1. Khi môi trường sẵn sàng hoặc chỉ có cảnh báo, lệnh SHALL thoát mã 0.

#### Scenario: Chẩn đoán trên dự án đầy đủ hợp lệ
- **WHEN** chạy `nightowl doctor` trong repo đã cài đặt đầy đủ hook, Node >= 22.13 và SQLite toàn vẹn
- **THEN** stdout hiển thị trạng thái hợp lệ cho toàn bộ 5 nhóm kiểm tra và lệnh thoát mã 0

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

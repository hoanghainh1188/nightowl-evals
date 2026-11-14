# Spec Delta

## ADDED Requirements

### Requirement: doctor kiểm tra local config
`nightowl doctor` SHALL kiểm tra project config và local overlay (nếu tồn tại): thiếu cả hai là OK (pass/info); file tồn tại nhưng invalid SHALL báo fail với path + lý do; file hợp lệ SHALL pass. Doctor SHALL NOT gọi mạng; SHALL NOT sửa file config trừ khi người dùng chạy lệnh khác đã document.

#### Scenario: Config hợp lệ
- **WHEN** có `nightowl.config.json` hợp lệ v1 và chạy `nightowl doctor`
- **THEN** kết quả có mục config pass (hoặc tương đương)

#### Scenario: Config invalid
- **WHEN** project config JSON hỏng hoặc schema fail và chạy `nightowl doctor`
- **THEN** mục config fail với stderr/stdout nêu lỗi; mã thoát doctor ≠ 0 theo quy tắc doctor hiện có khi có fail

### Requirement: init tạo mẫu project config khi thiếu
`nightowl init` SHALL tạo file project config mẫu an toàn (chỉ `version` và/hoặc defaults trống đã document) khi file chưa tồn tại, và SHALL NOT ghi đè file đã có. Mẫu SHALL NOT chứa secret. Init vẫn thêm `.nightowl/` vào `.gitignore` như hiện tại (local overlay nằm dưới đó).

#### Scenario: Init lần đầu không có config
- **WHEN** chạy `nightowl init` trong repo chưa có project config
- **THEN** file project config được tạo với schema v1 tối thiểu; mã thoát 0

#### Scenario: Init không ghi đè
- **WHEN** project config đã tồn tại và chạy `nightowl init` lại
- **THEN** nội dung file config không bị thay bởi mẫu mặc định

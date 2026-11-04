# Spec Delta

## ADDED Requirements

### Requirement: Bỏ qua sự kiện do NightOwl tạo ra
Khi biến môi trường `NIGHTOWL_INTERNAL` bằng `1`, `nightowl log` SHALL NOT lưu sự kiện nào và SHALL NOT ghi vào `.nightowl/nightowl.log`, nhưng vẫn đọc hết stdin, im lặng và thoát mã 0.

#### Scenario: Lời gọi phân loại kích hoạt hook
- **WHEN** payload `UserPromptSubmit` được pipe vào `nightowl log` với `NIGHTOWL_INTERNAL=1`
- **THEN** database không có sự kiện mới, mã thoát 0, stdout và stderr rỗng

# Spec Delta

## ADDED Requirements

### Requirement: Cài git hook trên Windows không phụ thuộc execute-bit
Khi `nightowl init` cài hoặc cập nhật git hook NightOwl trên `win32`, lệnh SHALL ghi nội dung hook gọi lệnh NightOwl tương ứng và SHALL NOT fail chỉ vì không đặt được quyền execute POSIX (`chmod`/`X_OK`). Trên POSIX, hành vi tạo hook executable (khi tạo mới) SHALL được giữ. `nightowl doctor` trên Windows SHALL tiếp tục bỏ qua cảnh báo execute-bit (đã document).

#### Scenario: Init hook trên win32
- **WHEN** chạy `nightowl init` trên môi trường `win32` (hoặc stub platform) trong repo git chưa có hook NightOwl
- **THEN** file hook chứa lệnh NightOwl; thoát 0 dù execute-bit không áp dụng như POSIX

#### Scenario: Doctor win32 không warn execute-bit
- **WHEN** trên `win32`, hook NightOwl tồn tại nhưng không “executable” theo nghĩa POSIX, chạy `nightowl doctor`
- **THEN** không cảnh báo thiếu execute-bit cho hook đó

# Spec Delta

## ADDED Requirements

### Requirement: Gắn noise metadata khi tạo failure
Mỗi bản ghi `failures` mới tạo từ post-commit SHALL lưu `noise_score` (REAL 0–1 hoặc NULL nếu chưa chấm được) và `noise_reasons` (chuỗi reason codes ổn định, có thể rỗng). Metadata này SHALL được tính local theo capability `noise-filtering` trước khi commit transaction tạo failure kết thúc.

#### Scenario: Failure thường có score
- **WHEN** post-commit tạo failure `manual-fix` vì dev sửa logic AI
- **THEN** hàng `failures` có `noise_score` số trong [0, 1] và `noise_reasons` là chuỗi hợp lệ (có thể rỗng)

### Requirement: Safe auto-noise không để flagged
Khi scoring xếp failure vào safe auto-noise, post-commit SHALL tạo failure với status `dismissed` (kèm reason auto-noise trong metadata) hoặc SHALL NOT tạo failure — chọn một hành vi thống nhất trong design và giữ idempotent với whitespace_only hiện có. Trong mọi trường hợp, failure đó SHALL NOT xuất hiện trong tổng lỗi không dismissed của `report`.

#### Scenario: Auto-noise không vào total report
- **WHEN** chỉ xảy ra thay đổi safe auto-noise rồi chạy `nightowl report`
- **THEN** `total` (không dismissed) không tăng vì thay đổi đó

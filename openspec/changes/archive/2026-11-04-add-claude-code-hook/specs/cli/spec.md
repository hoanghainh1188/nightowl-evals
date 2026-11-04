# Spec Delta

## MODIFIED Requirements

### Requirement: Lệnh con chưa triển khai
Các lệnh `report`, `export` SHALL được đăng ký. Khi chưa có logic, mỗi lệnh SHALL in ra stderr một dòng báo lệnh chưa được triển khai, không thay đổi file nào, và thoát mã 0.

#### Scenario: Gọi lệnh report khi chưa triển khai
- **WHEN** người dùng chạy `nightowl report`
- **THEN** stderr báo `report` chưa được triển khai, không file nào trong thư mục hiện tại bị tạo hoặc sửa, mã thoát là 0

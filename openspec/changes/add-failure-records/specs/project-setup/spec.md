# Spec Delta

## ADDED Requirements

### Requirement: Cài git hook post-commit
`nightowl init` SHALL đảm bảo hook `post-commit` của repo gọi `nightowl postcommit`, theo đúng các quy tắc an toàn của hook `pre-commit`: tạo mới khi chưa có, chèn sau shebang của hook shell có sẵn, không sửa hook do `core.hooksPath` quản lý, hook không phải shell hoặc hook là symlink (khi đó in hướng dẫn), không thêm trùng khi chạy lại, và không bao giờ làm git lỗi.

#### Scenario: Chạy init trên repo đã cài từ tuần 1
- **WHEN** repo đã có hook `pre-commit` của NightOwl và chạy `nightowl init`
- **THEN** hook `pre-commit` không đổi và hook `post-commit` gọi `nightowl postcommit` được tạo

#### Scenario: nightowl bị gỡ khỏi máy
- **WHEN** hook `post-commit` đã cài nhưng lệnh `nightowl` không còn trong `PATH`, và dev commit
- **THEN** commit thành công và không có thông báo lỗi nào

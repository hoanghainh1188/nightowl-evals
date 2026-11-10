# Spec Delta

## ADDED Requirements

### Requirement: Đăng ký lệnh completion
Package SHALL đăng ký lệnh con `completion`. `nightowl --help` SHALL liệt kê `completion`. `nightowl completion --help` SHALL in trợ giúp (cách gọi `bash|zsh|fish`) rồi thoát mã 0 mà không in script completion đầy đủ như khi chọn shell.

#### Scenario: Help tổng có completion
- **WHEN** chạy `nightowl --help`
- **THEN** stdout chứa `completion`

#### Scenario: completion --help
- **WHEN** chạy `nightowl completion --help`
- **THEN** stdout là trợ giúp của `completion`, mã thoát 0, và không phải toàn bộ script Bash/Zsh/Fish dài (hoặc rõ là help chứ không phải eval script)

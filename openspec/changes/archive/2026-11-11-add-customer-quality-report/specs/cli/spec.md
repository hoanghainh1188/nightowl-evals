# Spec Delta

## ADDED Requirements

### Requirement: Đăng ký lệnh customer-report
`nightowl` SHALL đăng ký lệnh con `customer-report` với mô tả một dòng trong help chung. `--help` của lệnh SHALL mô tả xuất báo cáo chất lượng AI cho khách (Markdown/HTML, mẫu VI–JA), các flag `--lang`, `--format`, `--since`, `--depth`, `--agent`, `--output`, và SHALL nêu rõ không gọi mạng / không lộ tên developer.

#### Scenario: help liệt kê lệnh
- **WHEN** chạy `nightowl --help`
- **THEN** stdout có `customer-report`

#### Scenario: customer-report --help
- **WHEN** chạy `nightowl customer-report --help`
- **THEN** stdout nêu `--lang`, `--format`, và audience báo cáo khách; mã thoát 0

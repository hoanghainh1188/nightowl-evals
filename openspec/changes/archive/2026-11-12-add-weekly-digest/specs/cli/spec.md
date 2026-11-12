# Spec Delta

## ADDED Requirements

### Requirement: Đăng ký lệnh digest
`nightowl` SHALL đăng ký lệnh con `digest` với mô tả một dòng trong help chung. `--help` của lệnh SHALL mô tả digest local cho standup/weekly, cửa sổ thời gian, định dạng Markdown/HTML, và SHALL nêu rõ không gửi email/Slack, không gọi mạng, không lộ tên developer.

#### Scenario: help liệt kê digest
- **WHEN** chạy `nightowl --help`
- **THEN** stdout có `digest`

#### Scenario: digest --help
- **WHEN** chạy `nightowl digest --help`
- **THEN** stdout nêu `--since` (hoặc tương đương), `--format`, và local-only / không gửi email; mã thoát 0

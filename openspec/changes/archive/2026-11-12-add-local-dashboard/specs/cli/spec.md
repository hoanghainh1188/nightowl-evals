# Spec Delta

## ADDED Requirements

### Requirement: Đăng ký lệnh dashboard
`nightowl` SHALL đăng ký lệnh con `dashboard` với mô tả một dòng trong help chung. `--help` của lệnh SHALL mô tả dashboard HTML local-only cho team nội bộ, các flag `--since`, `--depth`, `--agent`, `--output`, `--open`, và SHALL nêu rõ không gọi mạng / không lộ tên developer / không phải SaaS dashboard.

#### Scenario: help liệt kê lệnh
- **WHEN** chạy `nightowl --help`
- **THEN** stdout có `dashboard`

#### Scenario: dashboard --help
- **WHEN** chạy `nightowl dashboard --help`
- **THEN** stdout nêu `--output`, `--open`, và local-only; mã thoát 0

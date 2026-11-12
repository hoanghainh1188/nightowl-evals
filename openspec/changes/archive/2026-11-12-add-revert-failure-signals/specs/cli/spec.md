# Spec Delta

## ADDED Requirements

### Requirement: Đăng ký lệnh ingest-revert
CLI `nightowl` SHALL đăng ký lệnh `ingest-revert` (hoặc tên đã document trong help gốc) với `--help` riêng. Lệnh SHALL xuất hiện trong danh sách help cấp cao khi NightOwl liệt kê subcommands.

#### Scenario: help liệt kê ingest-revert
- **WHEN** chạy `nightowl --help` hoặc tương đương liệt kê lệnh
- **THEN** stdout gồm tên lệnh ingest-revert (hoặc alias đã document)

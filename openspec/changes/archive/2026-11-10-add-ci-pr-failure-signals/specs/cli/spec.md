# Spec Delta

## ADDED Requirements

### Requirement: Đăng ký lệnh ingest-ci và ingest-pr
`nightowl` SHALL đăng ký lệnh con ingest CI và ingest PR (tên chính xác theo design, ví dụ `ingest-ci` / `ingest-pr`) với mô tả một dòng trong help chung. `--help` từng lệnh SHALL mô tả input file, giới hạn không bịa `ai_content`, và (với PR) điều kiện opt-in GitHub API.

#### Scenario: help liệt kê lệnh
- **WHEN** chạy `nightowl --help`
- **THEN** stdout có tên cả hai lệnh ingest

#### Scenario: ingest-ci --help
- **WHEN** chạy `nightowl ingest-ci --help`
- **THEN** stdout nêu `--file` / đường dẫn JUnit hoặc summary và mặc định không mạng

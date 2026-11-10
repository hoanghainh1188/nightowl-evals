# Spec Delta

## ADDED Requirements

### Requirement: doctor help nêu kiểm tra đa agent
`nightowl doctor --help` SHALL nêu rằng lệnh kiểm tra cấu hình ingest đa agent (theo mức hỗ trợ) ngoài Claude Code và Git hooks.

#### Scenario: doctor --help
- **WHEN** chạy `nightowl doctor --help`
- **THEN** stdout đề cập kiểm tra agent hooks hoặc maturity đa agent

## MODIFIED Requirements

### Requirement: help nêu đa agent
Help của `init`, `log`, `report`, `review`, `uninstall` SHALL mô tả ngắn hỗ trợ đa agent và các flag `--agents` / `--agent` khi có. `init --help` SHALL gợi ý rằng không phải mọi agent đều có hook native (xem README maturity).

#### Scenario: init --help
- **WHEN** chạy `nightowl init --help`
- **THEN** stdout có `--agents` và liệt kê hoặc trỏ tới danh sách agent hỗ trợ / maturity

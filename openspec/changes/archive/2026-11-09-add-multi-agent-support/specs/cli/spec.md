## ADDED Requirements

### Requirement: help nêu đa agent
Help của `init`, `log`, `report`, `review`, `uninstall` SHALL mô tả ngắn hỗ trợ đa agent và các flag `--agents` / `--agent` khi có.

#### Scenario: init --help
- **WHEN** chạy `nightowl init --help`
- **THEN** stdout có `--agents` và liệt kê hoặc trỏ tới danh sách agent hỗ trợ

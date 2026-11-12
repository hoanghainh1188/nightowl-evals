# Spec Delta

## ADDED Requirements

### Requirement: Help nêu cờ privacy export
`--help` của `export` SHALL mô tả các cờ privacy đã document (`--redact-paths`, `--privacy-dry-run` hoặc tương đương) và ý nghĩa không lộ secret plaintext trên dry-run. Help `customer-report` / `dashboard` / `digest` SHALL nêu cờ coarsen path nếu lệnh hỗ trợ.

#### Scenario: export --help có privacy
- **WHEN** chạy `nightowl export --help`
- **THEN** stdout chứa ít nhất một trong các cờ privacy đã document

# Spec Delta

## ADDED Requirements

### Requirement: Help nêu --workspace và module workspace
`--help` của `report` / `customer-report` / `dashboard` / `digest` SHALL mô tả `--workspace` (khi lệnh hỗ trợ) và nêu rằng module có thể lấy theo package/workspace root khi monorepo được phát hiện, còn không thì giữ `--depth`.

#### Scenario: report --help có workspace
- **WHEN** chạy `nightowl report --help`
- **THEN** stdout chứa `--workspace`

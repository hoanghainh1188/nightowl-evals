# Spec Delta

## ADDED Requirements

### Requirement: Completion flag prune profile
Catalog completion của `prune` SHALL gồm `--profile` (và giữ `--days`, `--dry-run`, `--vacuum`) khi change thêm flag đó.

#### Scenario: Catalog prune có --profile
- **WHEN** đọc catalog completion lệnh `prune`
- **THEN** entry gồm `--profile`

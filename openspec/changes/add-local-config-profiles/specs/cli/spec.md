# Spec Delta

## ADDED Requirements

### Requirement: Help nêu local config profiles
`nightowl --help` và/hoặc `--help` của `report`, `digest`, `prune`, `doctor`, `export`, `share-pack` (khi áp dụng) SHALL đề cập file config local (tên path đã document), precedence flag > config, và rằng config không sync cloud / không chứa secret. Help SHALL NOT hứa SaaS settings.

#### Scenario: report --help có config
- **WHEN** chạy `nightowl report --help`
- **THEN** stdout đề cập config file hoặc defaults từ config / `nightowl.config`

#### Scenario: doctor --help có kiểm tra config
- **WHEN** chạy `nightowl doctor --help`
- **THEN** stdout đề cập kiểm tra config hợp lệ (hoặc tương đương)

# Spec Delta

## ADDED Requirements

### Requirement: Help nêu timing/perf local
`nightowl doctor --help` SHALL nêu kiểm tra timing/query budget (hoặc hiệu năng đọc DB). Nếu `report` có `--debug-timing`, `report --help` SHALL mô tả cờ đó (stderr timing, không đổi JSON/text chính).

#### Scenario: doctor --help có timing
- **WHEN** chạy `nightowl doctor --help`
- **THEN** stdout đề cập timing, budget, hoặc performance/query

### Requirement: report --debug-timing opt-in
Khi có cờ `--debug-timing`, `nightowl report` SHALL in thông tin thời gian các bước đọc chính ra **stderr** và giữ stdout/JSON semantics không đổi. Mặc định không có cờ thì không in timing.

#### Scenario: Debug timing trên stderr
- **WHEN** chạy `nightowl report --debug-timing --json` trên store hợp lệ
- **THEN** stderr chứa timing/ms; stdout vẫn JSON report hợp lệ

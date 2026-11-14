## ADDED Requirements

### Requirement: Completion flag isolation cho eval
Catalog completion `eval` SHALL gồm `--isolation` và `--setup-command`.

#### Scenario: Catalog eval có isolation
- **WHEN** sinh script completion
- **THEN** danh sách flag của `eval` chứa `--isolation` và `--setup-command`

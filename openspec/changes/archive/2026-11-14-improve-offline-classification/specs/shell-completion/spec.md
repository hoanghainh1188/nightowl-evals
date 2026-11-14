## ADDED Requirements

### Requirement: Completion gợi ý --offline cho classify
Completion catalog SHALL liệt kê `--offline` (hoặc cờ offline đã document) trong entry lệnh `classify`, cùng các flag classify hiện có (`--yes`, `--transport`, `--limit`, `--model`, `--redo`).

#### Scenario: Catalog classify có --offline
- **WHEN** đọc catalog completion lệnh `classify`
- **THEN** entry gồm `--offline`

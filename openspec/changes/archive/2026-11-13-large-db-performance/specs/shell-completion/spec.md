# Spec Delta

## ADDED Requirements

### Requirement: Completion flag report debug-timing
Catalog completion của `report` SHALL gồm `--debug-timing` khi change thêm cờ đó.

#### Scenario: Catalog report có --debug-timing
- **WHEN** đọc catalog completion lệnh `report`
- **THEN** entry gồm `--debug-timing`

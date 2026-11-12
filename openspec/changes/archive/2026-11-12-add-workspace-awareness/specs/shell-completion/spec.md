# Spec Delta

## ADDED Requirements

### Requirement: Completion flag --workspace
Catalog completion SHALL gồm `--workspace` trên các lệnh báo cáo hỗ trợ filter workspace (`report`, `customer-report`, `dashboard`, `digest`).

#### Scenario: Catalog report có --workspace
- **WHEN** dựng catalog completion
- **THEN** entry `report` gồm `--workspace`

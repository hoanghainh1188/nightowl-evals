# Spec Delta

## ADDED Requirements

### Requirement: Completion biết --config khi có
Nếu CLI thêm `--config <path>` (override đường dẫn project config đã document), completion catalog SHALL liệt kê `--config` cho các lệnh đọc config chính (`report`, `digest`, `prune`, `doctor`, `export`, `share-pack`, `dashboard` khi áp dụng). Nếu không có flag `--config`, requirement này MAY được thỏa bằng document-only — nhưng design v1 kỳ vọng có flag để test/CI.

#### Scenario: Catalog có --config
- **WHEN** generate completion sau khi flag `--config` được thêm
- **THEN** catalog/completion script chứa token `--config` cho ít nhất `report` hoặc `doctor`

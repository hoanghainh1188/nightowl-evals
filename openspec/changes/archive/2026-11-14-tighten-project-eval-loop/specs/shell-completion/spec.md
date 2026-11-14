## ADDED Requirements

### Requirement: Completion biết --status trên export khi có
Nếu `export` thêm `--status` (hoặc filter status đã document), completion catalog SHALL liệt kê flag đó cho lệnh `export`.

#### Scenario: Catalog export có --status
- **WHEN** generate completion sau khi flag status được thêm
- **THEN** catalog/completion chứa token `--status` cho `export`

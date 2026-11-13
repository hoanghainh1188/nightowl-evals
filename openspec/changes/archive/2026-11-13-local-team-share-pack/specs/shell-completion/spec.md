# Spec Delta

## ADDED Requirements

### Requirement: Completion cho share-pack
Catalog completion SHALL gồm subcommand share-pack (tên đã document) với các flag dài đã document (ít nhất `--output`/`-o`, cờ redaction/archive/`--since` nếu có).

#### Scenario: Catalog có share-pack
- **WHEN** dựng catalog completion từ registry lệnh
- **THEN** có mục `share-pack` (hoặc tên đã chọn) với danh sách flag không rỗng

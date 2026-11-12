# Spec Delta

## ADDED Requirements

### Requirement: Completion cho eval-compare và flag eval A/B
Catalog completion SHALL gồm subcommand so sánh eval đã document (ví dụ `eval-compare`) với các flag dài đã document (ít nhất `--input`, `--baseline`, `--format`, `--output` hoặc tương đương). Catalog `eval` SHALL gồm `--label` và flag report đã document khi `eval` hỗ trợ chúng.

#### Scenario: Catalog có eval-compare
- **WHEN** dựng catalog completion từ registry lệnh
- **THEN** có mục lệnh compare với danh sách flag không rỗng gồm ít nhất một flag đường dẫn input/baseline

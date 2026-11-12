# Spec Delta

## ADDED Requirements

### Requirement: Completion cho digest
Catalog completion SHALL gồm lệnh `digest` và các flag dài đã document cho lệnh đó (ít nhất `--since`, `--format`, `--output` hoặc tương đương).

#### Scenario: Catalog có digest
- **WHEN** dựng catalog completion từ registry lệnh
- **THEN** có mục `digest` với danh sách flag không rỗng chứa ít nhất một flag thời gian/định dạng

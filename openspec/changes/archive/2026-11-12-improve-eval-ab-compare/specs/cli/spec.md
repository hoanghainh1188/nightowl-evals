# Spec Delta

## ADDED Requirements

### Requirement: Đăng ký lệnh eval-compare
`nightowl` SHALL đăng ký lệnh con so sánh eval A/B đã document (ví dụ `eval-compare`) với mô tả một dòng trong help chung. `--help` của lệnh SHALL mô tả input/baseline, format Markdown/HTML, và nêu rõ không gọi mạng/LLM.

#### Scenario: help liệt kê eval-compare
- **WHEN** chạy `nightowl --help`
- **THEN** stdout có tên lệnh compare đã document

#### Scenario: eval-compare --help
- **WHEN** chạy `nightowl eval-compare --help` (hoặc tên đã document)
- **THEN** stdout nêu `--input` / `--baseline` / `--format` (hoặc tương đương); mã thoát 0

### Requirement: Help eval nêu label và report
`--help` của `nightowl eval` SHALL mô tả cờ `--label` và cờ xuất báo cáo A/B đã document (nếu lệnh hỗ trợ trên `eval`).

#### Scenario: eval --help có label
- **WHEN** chạy `nightowl eval --help`
- **THEN** stdout chứa `--label` (hoặc tên tương đương đã document)

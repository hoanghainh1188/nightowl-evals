# Spec Delta

## ADDED Requirements

### Requirement: report đọc defaults từ local config
Khi không truyền flag tương ứng, `nightowl report` SHALL áp dụng defaults từ local-config đã merge cho các khoá đã document (ít nhất `failOnRate`, `agents`, `workspaces` nếu có trong config). Flag CLI tường minh SHALL thắng. Report vẫn chỉ đọc store; config invalid SHALL thoát ≠ 0 trước khi mở/đọc sai semantics.

#### Scenario: fail-on-rate từ config
- **WHEN** config đặt ngưỡng fail-on-rate và chạy `report` không `--fail-on-rate` trên store có changed rate vượt ngưỡng
- **THEN** lệnh thoát mã 1 như khi truyền flag tương đương

#### Scenario: CLI override agents
- **WHEN** config liệt kê agents và người dùng truyền `--agent` khác
- **THEN** report chỉ filter theo `--agent` CLI

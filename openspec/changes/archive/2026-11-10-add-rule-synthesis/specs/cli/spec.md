## ADDED Requirements

### Requirement: Đăng ký lệnh suggest-rules
`nightowl` SHALL đăng ký lệnh con `suggest-rules` với mô tả một dòng trong help chung. `nightowl suggest-rules --help` SHALL mô tả bộ lọc (`--since`, `--category`, `--agent`, trạng thái), chế độ LLM opt-in, và tuỳ chọn ghi file (`--write` / `--output` nếu có).

#### Scenario: help liệt kê lệnh
- **WHEN** chạy `nightowl --help`
- **THEN** stdout có `suggest-rules`

#### Scenario: suggest-rules --help
- **WHEN** chạy `nightowl suggest-rules --help`
- **THEN** stdout nêu rõ mặc định không gọi LLM và không tự sửa CLAUDE.md / `.cursorrules`

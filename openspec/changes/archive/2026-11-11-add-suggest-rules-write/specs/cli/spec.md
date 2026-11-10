# Spec Delta

## MODIFIED Requirements

### Requirement: Đăng ký lệnh suggest-rules
`nightowl` SHALL đăng ký lệnh con `suggest-rules` với mô tả một dòng trong help chung. `nightowl suggest-rules --help` SHALL mô tả bộ lọc (`--since`, `--category`, `--agent`, trạng thái), chế độ LLM opt-in, `--output` (file đề xuất độc lập), và `--write` (chèn/cập nhật khối marker trong file rule dự án). Help SHALL nêu rõ mặc định không gọi LLM và không sửa file rule trừ khi có `--output` hoặc `--write`.

#### Scenario: help liệt kê lệnh
- **WHEN** chạy `nightowl --help`
- **THEN** stdout có `suggest-rules`

#### Scenario: suggest-rules --help
- **WHEN** chạy `nightowl suggest-rules --help`
- **THEN** stdout nêu mặc định không gọi LLM; phân biệt `--output` vs `--write`; và không tự sửa file rule khi không có các cờ đó

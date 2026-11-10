## ADDED Requirements

### Requirement: Đăng ký lệnh suggest-regressions
`nightowl` SHALL đăng ký lệnh con `suggest-regressions` với mô tả một dòng trong help chung. `nightowl suggest-regressions --help` SHALL mô tả bộ lọc, chế độ ghi file, và mặc định không gọi LLM / không tự sửa suite dự án.

#### Scenario: help liệt kê lệnh
- **WHEN** chạy `nightowl --help`
- **THEN** stdout có `suggest-regressions`

#### Scenario: suggest-regressions --help
- **WHEN** chạy `nightowl suggest-regressions --help`
- **THEN** stdout nêu rõ mặc định không gọi LLM và không tự ghi file test trừ khi có tuỳ chọn ghi tường minh

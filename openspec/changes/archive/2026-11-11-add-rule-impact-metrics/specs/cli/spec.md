# Spec Delta

## ADDED Requirements

### Requirement: Đăng ký lệnh rule-impact
`nightowl` SHALL đăng ký lệnh con đo impact rule (tên chính xác theo design, ví dụ `rule-impact`) với mô tả một dòng trong help chung. `--help` của lệnh (và subcommand mark/show nếu có) SHALL mô tả mark baseline, so sánh cửa sổ, và mặc định offline / không LLM.

#### Scenario: help liệt kê lệnh
- **WHEN** chạy `nightowl --help`
- **THEN** stdout có tên lệnh rule-impact đã đăng ký

#### Scenario: rule-impact --help
- **WHEN** chạy `nightowl rule-impact --help`
- **THEN** stdout nêu mark / show (hoặc tương đương) và không mạng mặc định

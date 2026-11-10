# Spec Delta

## ADDED Requirements

### Requirement: Completion gợi ý lệnh rule-impact
Script `nightowl completion` SHALL gợi ý tên lệnh rule-impact đã đăng ký, kèm flag chính (`--label`, `--category`, `--json`, và subcommand mark/show nếu có) trong catalog completion.

#### Scenario: Tên lệnh trong script
- **WHEN** lấy stdout `nightowl completion bash`
- **THEN** nội dung có tên lệnh rule-impact

# Spec Delta

## ADDED Requirements

### Requirement: Completion gợi ý lệnh ingest
Script `nightowl completion` SHALL gợi ý tên lệnh ingest CI và ingest PR đã đăng ký, kèm các flag chính (`--file`, và cờ opt-in GitHub nếu có) trong catalog completion.

#### Scenario: Tên lệnh trong script
- **WHEN** lấy stdout `nightowl completion bash`
- **THEN** nội dung chứa tên lệnh ingest CI và ingest PR

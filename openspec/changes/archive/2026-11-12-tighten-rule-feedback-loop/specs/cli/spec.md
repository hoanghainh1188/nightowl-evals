# Spec Delta

## ADDED Requirements

### Requirement: Help nêu vòng phản hồi rule local
`--help` của `suggest-rules` và `rule-impact` SHALL nêu ngắn vòng phản hồi local: đề xuất rule → (opt-in `--write`/`--output`) → `rule-impact mark --label` → xem impact / digest / dashboard. Help SHALL nhắc mặc định không ghi file rule và không gọi LLM trừ opt-in đã có. `--help` của `digest` và/hoặc `dashboard` MAY nhắc dòng rule-impact khi có mark.

#### Scenario: suggest-rules --help có vòng phản hồi
- **WHEN** chạy `nightowl suggest-rules --help`
- **THEN** stdout đề cập `rule-impact` mark hoặc bước tiếp sau khi ghi đề xuất

#### Scenario: rule-impact --help có vòng phản hồi
- **WHEN** chạy `nightowl rule-impact --help`
- **THEN** stdout đề cập suggest-rules và/hoặc digest/dashboard như bề mặt xem tóm tắt sau mark

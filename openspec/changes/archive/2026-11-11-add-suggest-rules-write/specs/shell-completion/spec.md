# Spec Delta

## ADDED Requirements

### Requirement: Completion gợi ý --write và --output cho suggest-rules
Script `nightowl completion` SHALL gợi ý cả `--write` và `--output` (và `--force` nếu có trong help) cho lệnh `suggest-rules`, phản ánh hai chế độ ghi riêng biệt chứ không gộp thành một alias ẩn.

#### Scenario: Flag ghi trong script
- **WHEN** lấy stdout `nightowl completion bash`
- **THEN** nội dung có `--write` và `--output` gắn với ngữ cảnh `suggest-rules` (hoặc trong catalog flag của lệnh đó)

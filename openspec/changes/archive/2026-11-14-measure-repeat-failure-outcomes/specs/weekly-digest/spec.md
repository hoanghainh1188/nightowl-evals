# Spec Delta

## ADDED Requirements

### Requirement: Digest nêu metric repeat
`nightowl digest` SHALL gồm một dòng hoặc khối ngắn về metric repeat (repeat vs new và/hoặc rate) trong cửa sổ digest, theo cùng định nghĩa `repeat-outcomes` (baseline mặc định hoặc flag đã document nếu digest hỗ trợ). SHALL NOT lộ tên developer; SHALL NOT gọi mạng.

#### Scenario: Digest Markdown có repeat
- **WHEN** chạy `nightowl digest` trên store có failure trong cửa sổ và baseline
- **THEN** Markdown stdout đề cập repeat/new hoặc repeat rate

#### Scenario: Digest HTML có repeat khi format html
- **WHEN** chạy `nightowl digest --format html -o <file>` với dữ liệu tương tự
- **THEN** HTML chứa tóm tắt repeat tương đương (không CDN)

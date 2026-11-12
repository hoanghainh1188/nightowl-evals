# Spec Delta

## ADDED Requirements

### Requirement: Help nêu kiểm tra adapter đa agent sâu hơn
`nightowl doctor --help` và/hoặc `init --help` SHALL nêu ngắn rằng kiểm tra/cài đặt đa agent gồm shape cấu hình best-effort (không chỉ tồn tại file) và trỏ README cho giới hạn maturity từng agent. SHALL NOT hứa hook native cho agent `manual`.

#### Scenario: doctor --help đề cập shape/maturity
- **WHEN** chạy `nightowl doctor --help`
- **THEN** stdout đề cập kiểm tra cấu hình agent / maturity / authenticity hoặc shape (ngôn ngữ đã document)

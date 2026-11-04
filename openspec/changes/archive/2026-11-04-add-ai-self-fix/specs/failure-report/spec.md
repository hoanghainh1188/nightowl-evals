## ADDED Requirements

### Requirement: Đếm lỗi theo nguồn
`nightowl report` SHALL in số lỗi theo nguồn (`manual-fix`, `ai-self-fix`), không tính lỗi `dismissed`. Bản `--json` SHALL có `by_source` với đủ hai khoá, kể cả khi bằng 0.

#### Scenario: Có cả hai nguồn
- **WHEN** database có 2 lỗi `manual-fix` và 1 lỗi `ai-self-fix`, rồi chạy `nightowl report --json`
- **THEN** `by_source` là `{"manual-fix": 2, "ai-self-fix": 1}`

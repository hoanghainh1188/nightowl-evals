# Spec Delta

## ADDED Requirements

### Requirement: Báo cáo theo cluster
`nightowl report` (text và `--json`) SHALL gồm tóm tắt cluster trong cửa sổ lọc hiện tại: ít nhất top N cluster theo count (N đã document, ví dụ 10) với key (hoặc nhãn an toàn), count, và có thể sample module/category. JSON SHALL có khoá ổn định (ví dụ `by_cluster` hoặc `clusters`). Dismissed SHALL không đếm vào cluster total giống quy tắc total hiện có trừ khi document khác. SHALL NOT lộ tên/email developer.

#### Scenario: JSON có clusters
- **WHEN** cửa sổ có ≥2 failure cùng cluster và chạy `nightowl report --json`
- **THEN** JSON có danh sách/object cluster với count ≥ 2 cho nhóm đó

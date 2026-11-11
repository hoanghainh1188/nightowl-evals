# Spec Delta

## ADDED Requirements

### Requirement: Báo cáo ước lượng nhiễu
`nightowl report` (text và `--json`) SHALL gồm ước lượng nhiễu trong cửa sổ lọc hiện tại: tỷ lệ review-noise `dismissed/(dismissed+confirmed)` khi mẫu đủ, cộng số lượng failure auto-noise (dismissed bởi safe auto-noise / reason auto) nếu có. JSON SHALL có khoá ổn định (ví dụ `noise`) với các field đã document. Khi thiếu mẫu review, tỷ lệ SHALL là `null` / n/a chứ không 0 giả.

#### Scenario: JSON có noise
- **WHEN** chạy `nightowl report --json` với vài failure confirmed và dismissed
- **THEN** JSON có object `noise` chứa tỷ lệ hoặc null và count auto-noise ≥ 0

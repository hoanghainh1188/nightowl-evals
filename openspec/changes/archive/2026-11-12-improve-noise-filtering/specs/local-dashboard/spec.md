# Spec Delta

## ADDED Requirements

### Requirement: Dashboard hiển thị ước lượng nhiễu
HTML từ `nightowl dashboard` SHALL có section ước lượng nhiễu dùng cùng định nghĩa với `report` (tỷ lệ review-noise khi đủ mẫu, count auto-noise). SHALL NOT lộ tên/email developer. Khi n/a, UI SHALL nói rõ chưa đủ dữ liệu review.

#### Scenario: Section noise trên HTML
- **WHEN** database có confirmed và dismissed rồi chạy `nightowl dashboard`
- **THEN** file HTML chứa nhãn nhiễu / noise và một tỷ lệ phần trăm hoặc n/a

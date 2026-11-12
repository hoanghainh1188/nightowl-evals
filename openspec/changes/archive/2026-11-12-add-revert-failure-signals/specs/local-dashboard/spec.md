# Spec Delta

## ADDED Requirements

### Requirement: Dashboard đếm tín hiệu revert
HTML từ `nightowl dashboard` SHALL hiển thị đếm tín hiệu revert cùng định nghĩa với `report` (trong Signals). SHALL NOT lộ tên/email developer.

#### Scenario: Section signals có revert
- **WHEN** database có ≥1 sự kiện revert rồi chạy `nightowl dashboard`
- **THEN** file HTML gồm nhãn revert (hoặc tương đương) và count > 0

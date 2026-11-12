# Spec Delta

## ADDED Requirements

### Requirement: Báo cáo tín hiệu revert
`nightowl report` (text và `--json`) SHALL gồm số đếm sự kiện `revert` trong cửa sổ `--since` cùng nhóm Signals (cạnh ci-fail / pr-review), không trộn vào `total` failures. JSON SHALL có field ổn định (ví dụ `signals.revert` hoặc tương đương) ≥ 0.

#### Scenario: Có revert trong cửa sổ
- **WHEN** store có ≥1 sự kiện revert trong `--since` và chạy `nightowl report --json`
- **THEN** JSON phản ánh đếm revert > 0

#### Scenario: Không có revert
- **WHEN** không có sự kiện revert trong cửa sổ
- **THEN** field đếm tương ứng = 0; lệnh vẫn thoát 0

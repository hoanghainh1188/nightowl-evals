## ADDED Requirements

### Requirement: Đếm theo trạng thái xem lại
`nightowl report` SHALL in số lỗi `confirmed`, `dismissed` và `flagged`. Bản `--json` SHALL có `by_status` với đủ ba khoá. Tổng số lỗi và các mục khác vẫn không tính lỗi `dismissed`.

#### Scenario: Đã xem một phần
- **WHEN** có 2 lỗi `confirmed`, 1 `dismissed` và 3 `flagged`, rồi chạy `nightowl report --json`
- **THEN** `by_status` là `{"confirmed": 2, "dismissed": 1, "flagged": 3}` và `total` là 5

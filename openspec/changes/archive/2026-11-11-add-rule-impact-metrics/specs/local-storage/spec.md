# Spec Delta

## ADDED Requirements

### Requirement: Lưu bản ghi rule applied và baseline
Schema SHALL cho phép lưu bản ghi áp dụng rule với: nhãn/id, thời điểm áp dụng (UTC ISO), bộ lọc (category/module/agent khi có), và snapshot baseline JSON (số đếm failure tại thời điểm mark). Migration SHALL chạy tự động khi mở store ghi / `init`. Dữ liệu SHALL chỉ nằm trong `.nightowl/` local.

#### Scenario: Ghi rồi đọc lại
- **WHEN** ghi một bản ghi applied với label `r1` và baseline `{ "total": 3 }`
- **THEN** đọc lại được đúng label, thời điểm, và baseline đã document

#### Scenario: Migration DB cũ
- **WHEN** mở DB schema trước migration này bằng bản NightOwl mới
- **THEN** migration áp dụng; có thể ghi bản ghi applied mới

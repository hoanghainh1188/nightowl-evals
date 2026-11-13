# Spec Delta

## ADDED Requirements

### Requirement: Index hỗ trợ cửa sổ report
Schema NightOwl SHALL có index trên cột dùng để lọc cửa sổ thời gian/agent của failures (và index hỗ trợ join check→edit đã document nếu cần) để `report`/`dashboard` đọc DB lớn không full-scan không cần thiết. Migration SHALL chạy tự động khi mở store ghi / `init`. Semantics dữ liệu SHALL không đổi.

#### Scenario: Migration thêm index failures theo thời gian
- **WHEN** mở DB schema cũ chưa có index failures theo `created_at` bằng NightOwl mới
- **THEN** migration tạo index; mở lại không lỗi; đếm failures theo `--since` cho cùng kết quả như trước

#### Scenario: Query since vẫn đúng
- **WHEN** có failures trước và sau một mốc `since` và chạy đếm report
- **THEN** chỉ failures `created_at >= since` được tính (semantics không đổi)

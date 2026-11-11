# Spec Delta

## ADDED Requirements

### Requirement: Schema noise trên failures
Migration schema mới SHALL thêm vào bảng `failures` cột `noise_score` (REAL NULL hoặc 0–1) và `noise_reasons` (TEXT, mặc định rỗng). Database cũ SHALL được nâng cấp khi mở store / `nightowl init` mà không mất bản ghi.

#### Scenario: Migration giữ failures cũ
- **WHEN** mở DB trước migration bằng bản NightOwl mới rồi đọc failures cũ
- **THEN** các hàng cũ vẫn đọc được; `noise_score` NULL hoặc mặc định an toàn; `noise_reasons` rỗng

### Requirement: Lưu thống kê học nhiễu local
Schema SHALL có chỗ lưu thống kê học nhiễu local (bảng riêng hoặc cấu trúc tương đương trong DB dự án) gồm ít nhất: reason/fingerprint key, số dismiss, số confirm, cập nhật lần cuối. Dữ liệu SHALL ở `.nightowl/` local và SHALL NOT được gửi đi.

#### Scenario: Bảng hoặc store học tồn tại sau init
- **WHEN** chạy `nightowl init` / mở store ở schema mới
- **THEN** có thể ghi và đọc một bản đếm dismiss/confirm theo key học

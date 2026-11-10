# Spec Delta

## ADDED Requirements

### Requirement: Sự kiện CI và PR trên events
Schema SHALL cho phép lưu sự kiện với loại (hoặc kind) đại diện CI fail và PR review, kèm payload JSON (test name, message, path, commit SHA, comment body đã cắt, …). Migration SHALL chạy tự động khi mở store ghi / `init`. Nguồn sự kiện MAY dùng giá trị đã document (ví dụ `ci` / `pr`) khác `claude-code`/`git` nếu cần — validation ứng dụng hoặc CHECK cập nhật tương ứng.

#### Scenario: Ghi sự kiện CI rồi đọc lại
- **WHEN** ghi một sự kiện CI fail với file `src/a.ts` và payload có `test_name`
- **THEN** đọc lại được đúng kind/source/file/payload đã document

#### Scenario: Migration DB cũ
- **WHEN** mở DB schema trước migration này bằng bản NightOwl mới
- **THEN** migration áp dụng; DB cũ vẫn đọc được; có thể ghi sự kiện CI/PR mới

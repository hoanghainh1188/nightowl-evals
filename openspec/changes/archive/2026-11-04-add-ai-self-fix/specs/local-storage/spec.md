## ADDED Requirements

### Requirement: Nguồn của bản ghi lỗi
Schema v4 SHALL thêm vào bảng `failures` cột `source` (chỉ nhận `manual-fix` hoặc `ai-self-fix`, mặc định `manual-fix`) và cột `feedback_event_id` trỏ tới sự kiện prompt. Database cũ SHALL được nâng lên v4 khi chạy `nightowl init`, và mọi bản ghi lỗi có sẵn nhận nguồn `manual-fix`.

#### Scenario: Nâng cấp database v3
- **WHEN** database ở v3 có hai bản ghi lỗi và chạy `nightowl init`
- **THEN** `PRAGMA user_version` là 4 và cả hai bản ghi có `source` là `manual-fix`, `feedback_event_id` là `NULL`

#### Scenario: Nguồn không hợp lệ
- **WHEN** ghi một bản ghi lỗi với `source` là `other`
- **THEN** SQLite từ chối bản ghi

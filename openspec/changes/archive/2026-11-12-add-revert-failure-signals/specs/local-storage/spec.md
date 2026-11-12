# Spec Delta

## ADDED Requirements

### Requirement: Sự kiện revert trên events
Schema/store SHALL cho phép ghi sự kiện với `source` phù hợp đã document (ví dụ `git`) và `kind` = `revert` (hoặc tương đương), kèm payload JSON (reverted commit SHA, revert commit SHA, failure_id khi có). `dedupe_key` UNIQUE khi có SHALL hỗ trợ idempotent ingest. Migration SHALL chạy tự động nếu cần mở rộng CHECK; nếu kind không bị CHECK cứng thì không bắt buộc migration.

#### Scenario: Ghi rồi đọc lại revert
- **WHEN** ghi một sự kiện revert với dedupe_key `revert:<sha>` rồi đọc theo kind
- **THEN** đọc lại được đúng kind/source/payload; lần ghi trùng dedupe không tạo hàng thứ hai

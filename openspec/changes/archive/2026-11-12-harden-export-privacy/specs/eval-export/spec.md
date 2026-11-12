# Spec Delta

## ADDED Requirements

### Requirement: Export áp dụng profile privacy
`nightowl export` SHALL áp dụng profile privacy (secret/email) lên trường text xuất (prompt / code / path theo design) trước khi ghi file hoặc stdout, ngoài quy tắc skip file nhạy cảm hiện có. Với `--redact-paths` (hoặc tên đã document) SHALL coarsen `file_path` (và path tương đương trong payload) theo profile. Với `--privacy-dry-run` (hoặc tương đương) SHALL không ghi file xuất đầy đủ (hoặc ghi không đổi theo design) và chỉ báo cáo đếm redaction/skip.

#### Scenario: Redact path trên JSONL
- **WHEN** export JSONL với `--redact-paths` và failure có `file_path` `src/a/b.ts`
- **THEN** dòng JSON có path coarsened; không còn `src/a/b.ts` đầy đủ nếu coarsen ẩn segment giữa

#### Scenario: Privacy dry-run
- **WHEN** chạy `nightowl export --privacy-dry-run` trên store có ≥1 failure
- **THEN** thoát 0; stderr/stdout nêu tổng số redaction hoặc skip; không tạo/ghi đè file xuất eval đầy đủ (trừ khi design document khác và vẫn không lộ secret)

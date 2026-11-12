# Spec Delta

## ADDED Requirements

### Requirement: Digest tôn trọng coarsen path
Khi bật cờ làm thô path đã document và digest có in path/module, output SHALL coarsen theo profile privacy. Nếu digest MVP không in path file, cờ MAY no-op nhưng SHALL vẫn được chấp nhận (không lỗi) khi có trên CLI chung hoặc bị bỏ qua đã document. Secret/email trong text SHALL được redacted nếu xuất hiện.

#### Scenario: Cờ coarsen được chấp nhận
- **WHEN** chạy `nightowl digest` với cờ coarsen path đã document
- **THEN** thoát 0 (hoặc lỗi cấu hình rõ nếu cờ không hỗ trợ — ưu tiên chấp nhận no-op); không crash

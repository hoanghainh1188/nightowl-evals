# Spec Delta

## ADDED Requirements

### Requirement: Cập nhật học nhiễu khi đánh dấu
Sau khi `nightowl review confirm|dismiss|reset` đổi status thành công, NightOwl SHALL cập nhật bảng/thống kê học nhiễu local gắn với failure đó (reason codes / fingerprint đã chốt). `reset` về `flagged` SHALL hoàn tác hoặc trung hoà đóng góp học của lần mark trước trong phạm vi đã document. Lệnh vẫn SHALL NOT gửi dữ liệu ra ngoài máy.

#### Scenario: Dismiss ghi học local
- **WHEN** dismiss một failure có `noise_reasons` chứa `comment-only`
- **THEN** thống kê học local tăng đếm dismiss cho reason đó và lệnh thoát 0

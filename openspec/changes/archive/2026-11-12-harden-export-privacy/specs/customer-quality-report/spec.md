# Spec Delta

## ADDED Requirements

### Requirement: Customer-report tôn trọng coarsen path
Khi người dùng bật cờ làm thô path đã document (cùng semantics với export privacy), `nightowl customer-report` SHALL coarsen mọi path/module hiển thị trong Markdown/HTML theo profile. Khi cờ tắt, hành vi hiện tại giữ nguyên. Vẫn SHALL NOT lộ tên/email developer; secret inline trong nhãn (nếu có) SHALL được redacted theo profile.

#### Scenario: Coarsen module trên báo cáo
- **WHEN** chạy customer-report với coarsen path bật và dữ liệu có module nhiều cấp
- **THEN** output không in đủ path sâu gốc nếu coarsen ẩn segment giữa; thoát 0

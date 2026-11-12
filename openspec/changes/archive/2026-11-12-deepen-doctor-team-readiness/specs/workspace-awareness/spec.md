# Spec Delta

## ADDED Requirements

### Requirement: Discovery phục vụ chẩn đoán doctor
API/profile discovery workspace đã document SHALL dùng được offline bởi `nightowl doctor` để báo trạng thái monorepo trên máy local. Discovery cho doctor SHALL NOT gọi mạng và SHALL cùng semantics với discovery dùng cho report (cùng nguồn config đã hỗ trợ).

#### Scenario: Doctor dùng cùng discovery
- **WHEN** repo có workspace config hợp lệ với ≥1 package và chạy `nightowl doctor`
- **THEN** kết quả doctor phản ánh discovery không rỗng (ok packages), khớp với việc discovery API trả về ≥1 workspace cho cùng root

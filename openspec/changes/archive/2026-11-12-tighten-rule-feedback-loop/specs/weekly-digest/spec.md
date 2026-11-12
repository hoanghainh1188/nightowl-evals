# Spec Delta

## ADDED Requirements

### Requirement: Digest rule-impact khớp dashboard
Dòng/tóm tắt rule-impact trong `nightowl digest` (Markdown và HTML) SHALL dùng cùng semantics và wording ổn định đã document với dashboard: có mark → label + before → after + delta; không mark → none recorded (hoặc tương đương); lỗi đọc → n/a. Thay đổi wording SHALL không đổi nghĩa đếm impact. SHALL NOT lộ tên/email developer.

#### Scenario: Digest và dashboard cùng none
- **WHEN** store không có rule-applied rồi chạy `digest` và `dashboard`
- **THEN** cả hai nêu none/n/a cho rule-impact; thoát 0

#### Scenario: Digest có mark
- **WHEN** store có rule-applied với label đã biết rồi chạy `nightowl digest`
- **THEN** output chứa label đó trong phần rule-impact

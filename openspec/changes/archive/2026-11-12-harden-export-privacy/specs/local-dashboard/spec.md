# Spec Delta

## ADDED Requirements

### Requirement: Dashboard tôn trọng coarsen path
Khi bật cờ làm thô path đã document, HTML `nightowl dashboard` SHALL coarsen nhãn module/path trong bảng/tóm tắt theo cùng profile privacy. Secret/email trong text tĩnh SHALL NOT xuất hiện dạng plaintext nếu khớp profile. Cờ tắt → hành vi hiện tại.

#### Scenario: Coarsen trên HTML
- **WHEN** chạy dashboard với coarsen path bật
- **THEN** file HTML không chứa ít nhất một path sâu đầy đủ đã có trong dữ liệu nếu coarsen áp dụng; thoát 0

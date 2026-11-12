# Spec Delta

## ADDED Requirements

### Requirement: Dashboard hiển thị rule-impact
HTML từ `nightowl dashboard` SHALL gồm một dòng hoặc section rule-impact dùng cùng semantics với digest: khi có bản rule-applied local, nêu label và tóm tắt before → after (delta); khi chưa có bản ghi, nêu none/n/a đã document; khi không đọc được mark, nêu n/a. SHALL NOT lộ tên/email developer. SHALL NOT gọi mạng.

#### Scenario: Có mark trên dashboard
- **WHEN** store có ≥1 bản rule-applied và chạy `nightowl dashboard`
- **THEN** file HTML chứa nhãn rule-impact (hoặc tương đương) kèm label đã mark

#### Scenario: Chưa mark trên dashboard
- **WHEN** store không có bản rule-applied và chạy `nightowl dashboard`
- **THEN** file HTML nêu rule-impact none/n/a; thoát 0

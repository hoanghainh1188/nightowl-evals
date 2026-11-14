## ADDED Requirements

### Requirement: Dashboard hiển thị eval-loop
HTML từ `nightowl dashboard` SHALL gồm một dòng hoặc section eval-loop dùng cùng semantics với digest: có run local → label + tóm tắt delta/baseline hoặc run mới nhất; chưa có → none/n/a; lỗi đọc → n/a. SHALL NOT lộ tên/email developer; SHALL NOT gọi mạng; SHALL NOT tải CDN.

#### Scenario: Dashboard có run
- **WHEN** `.nightowl/runs/` có run với label `rules-v2` và chạy `dashboard`
- **THEN** HTML chứa nhãn eval-loop kèm `rules-v2`

#### Scenario: Dashboard chưa có run
- **WHEN** chưa có run và chạy `dashboard`
- **THEN** HTML nêu eval-loop none/n/a; thoát 0

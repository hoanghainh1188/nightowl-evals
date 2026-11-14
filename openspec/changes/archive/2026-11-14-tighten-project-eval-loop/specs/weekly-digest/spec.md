## ADDED Requirements

### Requirement: Digest có tóm tắt eval-loop
`nightowl digest` (Markdown và HTML) SHALL gồm một dòng hoặc khối ngắn eval-loop dùng cùng semantics với dashboard: có run → label (nếu có) + tóm tắt delta vs baseline hoặc chỉ số run mới nhất đã document; không run → none/n/a; lỗi đọc runs → n/a. SHALL NOT lộ tên developer; SHALL NOT gọi mạng; SHALL NOT đổi semantics rule-impact/repeat hiện có.

#### Scenario: Digest không có run
- **WHEN** chạy `digest` khi chưa có file trong `.nightowl/runs/`
- **THEN** phần eval-loop nói none/n/a; thoát 0

#### Scenario: Digest có run + label
- **WHEN** có run với label `prompt-v3` và chạy `digest`
- **THEN** output chứa `prompt-v3` trong phần eval-loop

# local-team-share Specification

## Purpose

Cho phép tạo gói báo cáo AI quality local đã redact để chia sẻ offline trong team, không upload và không lộ tên developer.

## Requirements

### Requirement: Lệnh share-pack local
NightOwl SHALL cung cấp lệnh CLI đã document (ví dụ `share-pack`) tạo gói share-out trên máy local từ store hiện có. Lệnh SHALL NOT gọi mạng, SHALL NOT upload, và SHALL NOT ghi tên hoặc email developer vào nội dung gói.

#### Scenario: Tạo pack thành công
- **WHEN** chạy lệnh share-pack trên project đã `init` có dữ liệu failures/checks
- **THEN** tạo thư mục (hoặc archive) local chứa report + digest + manifest; thoát 0; không có network call

#### Scenario: Chưa init
- **WHEN** chạy share-pack khi chưa có store
- **THEN** stderr lỗi rõ; thoát ≠ 0; không tạo pack giả

### Requirement: Nội dung gói tối thiểu
Gói SHALL gồm ít nhất: (1) bản report share-safe đã document, (2) bản digest share-safe đã document, (3) manifest nêu privacy flags / generatedAt / thành phần file. Mặc định path labels SHALL được coarsen (hoặc tương đương share-safe) trừ khi user tắt bằng cờ đã document.

#### Scenario: Manifest và redaction mặc định
- **WHEN** tạo pack với mặc định
- **THEN** manifest liệt kê file trong gói và ghi nhận redaction/path coarsen bật; report/digest không chứa path module đầy đủ nếu dữ liệu gốc có path sâu

### Requirement: Output path và archive tuỳ chọn
Mặc định gói ghi dưới `.nightowl/` (path đã document) hoặc `-o`/`--output` do user chỉ định. Khi bật cờ archive đã document, lệnh SHALL tạo file nén local (tar.gz hoặc tương đương Node built-in) trên máy; SHALL NOT yêu cầu tool mạng.

#### Scenario: -o thư mục
- **WHEN** chạy share-pack với `--output <dir>`
- **THEN** nội dung gói nằm dưới thư mục đó (tạo parent nếu cần theo design)

#### Scenario: Archive local
- **WHEN** chạy share-pack với cờ archive
- **THEN** tồn tại file archive local chứa cùng thành phần tối thiểu; không upload

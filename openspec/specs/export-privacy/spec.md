# export-privacy Specification

## Purpose

Cung cấp profile redaction/privacy thống nhất trên máy để nội dung xuất và báo cáo NightOwl không để lọt secret/PII rõ ràng hay path đầy đủ khi người dùng chọn làm thô path, kèm dry-run liệt kê chỗ bị che.

## Requirements

### Requirement: Profile redaction dùng chung
NightOwl SHALL cung cấp một profile privacy local (có thể qua module/API nội bộ đã document) gồm ít nhất: (1) che hoặc loại secret inline theo bộ pattern mạnh hơn hoặc bằng hook hiện có, (2) che chuỗi dạng email trong text xuất, (3) tuỳ chọn coarsen đường dẫn file/module. Profile SHALL NOT gọi mạng.

#### Scenario: Che secret inline
- **WHEN** áp dụng profile lên chuỗi chứa token dạng secret đã document (ví dụ `sk-ant-…`)
- **THEN** đầu ra không còn plaintext token đó (thay bằng marker redacted hoặc tương đương)

#### Scenario: Che email
- **WHEN** áp dụng profile lên chuỗi chứa `user@example.com`
- **THEN** đầu ra không còn địa chỉ email đầy đủ

### Requirement: Coarsen path opt-in
Khi bật tuỳ chọn làm thô path đã document, path dạng `a/b/c.ts` SHALL được chuyển thành dạng coarsened đã document (ví dụ giữ segment đầu và tên file, ẩn khúc giữa bằng `**`). Khi tắt, path giữ nguyên (trừ khi bị skip vì sensitive name).

#### Scenario: Coarsen bật
- **WHEN** coarsen path bật và đầu vào là `src/hooks/git/run.ts`
- **THEN** đầu ra khớp dạng coarsened đã document và không còn đủ mọi segment trung gian rõ ràng

### Requirement: Dry-run không lộ secret
Chế độ dry-run privacy (cờ đã document) SHALL báo số/loại chỗ sẽ bị che hoặc skip (secret / email / path) trên stderr hoặc stdout đã document, rồi thoát 0 khi cấu hình hợp lệ, và SHALL NOT in plaintext secret bị phát hiện.

#### Scenario: Dry-run có secret
- **WHEN** chạy dry-run trên nội dung có secret inline
- **THEN** báo cáo có đếm/loại secret ≥ 1 và stdout/stderr không chứa chuỗi secret gốc

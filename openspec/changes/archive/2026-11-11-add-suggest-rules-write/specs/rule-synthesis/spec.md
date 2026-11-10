# Spec Delta

## MODIFIED Requirements

### Requirement: Mặc định không LLM và không ghi file dự án
Không có cờ opt-in LLM, lệnh SHALL chỉ dùng heuristic/template local. Không có `--output` và không có `--write`, lệnh SHALL NOT tạo/sửa file trên đĩa (chỉ stdout) và SHALL NOT sửa `CLAUDE.md`, `.cursorrules`, hay file rule khác trong repo.

#### Scenario: Dry output mặc định
- **WHEN** chạy `nightowl suggest-rules` không `--yes`, không `--output`, và không `--write`
- **THEN** chỉ in đề xuất ra stdout; không gọi mạng; không đổi file nào trên đĩa

### Requirement: Ghi file chỉ khi chỉ định rõ
Lệnh SHALL phân biệt hai chế độ ghi tường minh (không dùng đồng thời):
- `--output <path>`: ghi **toàn bộ** tài liệu đề xuất NightOwl (có marker) vào đường dẫn đó — tạo mới hoặc thay thế file đề xuất NightOwl theo quy tắc replace đã document; từ chối đè file không phải đề xuất NightOwl trừ khi `--force`.
- `--write <path>`: **chèn hoặc cập nhật** một khối đề xuất giới hạn bởi marker bắt đầu/kết thúc NightOwl bên trong file đích (ví dụ `CLAUDE.md`), giữ nguyên mọi nội dung ngoài khối; lần chạy sau với cùng path SHALL idempotent thay thế đúng khối đó.

`--write` SHALL NOT xoá hay ghi đè nội dung người dùng ngoài vùng marker. Khi file đích chưa có marker: SHALL thêm khối marker (thường append cuối file) trừ khi design chọn từ chối rõ. Khi marker không khớp/hỏng: SHALL báo lỗi rõ và thoát ≠ 0 trừ khi `--force` theo điều kiện an toàn đã document (không biến `--force` thành “đè cả file rule”). Symlink đích SHALL bị từ chối.

#### Scenario: Write path
- **WHEN** `nightowl suggest-rules --write .nightowl/suggested-rules.md`
- **THEN** file được tạo/ cập nhật với nội dung đề xuất trong khối marker NightOwl; stdout hoặc stderr có thể xác nhận đường dẫn

#### Scenario: --output file đề xuất độc lập
- **WHEN** `nightowl suggest-rules --output .nightowl/suggested-rules.md`
- **THEN** file được tạo/cập nhật với toàn bộ Markdown đề xuất + marker NightOwl; không sửa `CLAUDE.md`

#### Scenario: --write inject vào file rule dự án
- **WHEN** `CLAUDE.md` đã có nội dung người dùng và chạy `nightowl suggest-rules --write CLAUDE.md`
- **THEN** file vẫn giữ nguyên phần ngoài khối NightOwl; khối marker chứa đề xuất mới; thoát 0

#### Scenario: --write cập nhật idempotent
- **WHEN** chạy `--write CLAUDE.md` lần hai sau khi đã có khối marker
- **THEN** chỉ một khối NightOwl còn lại; nội dung ngoài khối không đổi

#### Scenario: Từ chối --output đè file lạ
- **WHEN** `--output` trỏ tới file đã tồn tại không phải đề xuất NightOwl và không có `--force`
- **THEN** không ghi; stderr nêu rõ; thoát ≠ 0

## ADDED Requirements

### Requirement: Marker bắt đầu và kết thúc cho khối --write
Khối do `--write` quản lý SHALL dùng cặp marker HTML comment (hoặc tương đương đã document) đánh dấu bắt đầu và kết thúc, đủ để thay thế vùng mà không phụ thuộc phần còn lại của file. Định dạng marker SHALL ổn định và được document trong help/README.

#### Scenario: Khối có start và end
- **WHEN** sau `--write` thành công mở file đích
- **THEN** nội dung chứa đúng một cặp marker bắt đầu/kết thúc NightOwl bao quanh đề xuất

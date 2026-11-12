# Spec Delta

## MODIFIED Requirements

### Requirement: Thư mục dữ liệu riêng tư
Thư mục `.nightowl/` SHALL được tạo như thư mục thật (không symlink) dùng riêng cho dữ liệu dự án. Trên POSIX, NightOwl SHALL đặt quyền chỉ người dùng hiện tại đọc/ghi/truy cập (`0700`), kể cả khi thư mục đã tồn tại với quyền rộng hơn. Trên Windows (`win32`), NightOwl SHALL cố gắng áp dụng mode tương đương best-effort; nếu hệ thống tệp (NTFS) không phản ánh `0700` như POSIX, NightOwl SHALL vẫn dùng thư mục đó khi nó là directory thật và không phải symlink, và SHALL NOT fail chỉ vì bit mode không khớp POSIX. Khi `.nightowl` là symlink hoặc không phải thư mục, NightOwl SHALL từ chối dùng nó và không ghi gì.

#### Scenario: Tạo mới
- **WHEN** NightOwl tạo `.nightowl/` lần đầu
- **THEN** thư mục có quyền `0700`

#### Scenario: Windows / NTFS không giữ 0700
- **WHEN** trên `win32`, tạo hoặc mở `.nightowl/` mà `chmod`/`mode` không cho kết quả `0700` như POSIX
- **THEN** NightOwl vẫn dùng thư mục directory thật; không thoát lỗi chỉ vì mode bit; không theo symlink

#### Scenario: Repo clone về có .nightowl là symlink
- **WHEN** `.nightowl` là symlink trỏ ra ngoài dự án
- **THEN** mở database báo lỗi và không file nào được tạo ở đích của symlink

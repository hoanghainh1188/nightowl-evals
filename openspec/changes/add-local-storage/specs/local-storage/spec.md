# Spec Delta

## Purpose

Lưu sự kiện và bản ghi lỗi của NightOwl trong một file SQLite nằm ngay trong dự án, để dữ liệu không bao giờ rời khỏi máy và mọi lệnh đọc cùng một nguồn.

## ADDED Requirements

### Requirement: Vị trí database
NightOwl SHALL lưu dữ liệu trong file `.nightowl/nightowl.db` ở gốc dự án, tức thư mục chứa `.git` gần nhất tính từ thư mục làm việc. Thư mục `.nightowl/` SHALL được tạo khi cần.

#### Scenario: Lần đầu ghi dữ liệu
- **WHEN** NightOwl ghi dữ liệu trong một repo git chưa có `.nightowl/`
- **THEN** file `.nightowl/nightowl.db` được tạo ở gốc repo

#### Scenario: Chạy từ thư mục con
- **WHEN** NightOwl chạy trong `<repo>/src/feature`
- **THEN** dữ liệu được ghi vào `<repo>/.nightowl/nightowl.db`, không tạo `.nightowl/` trong thư mục con

#### Scenario: Ngoài repo git
- **WHEN** NightOwl chạy ở thư mục không thuộc repo git nào
- **THEN** không file nào được tạo và thao tác ghi báo lỗi "không tìm thấy dự án" cho nơi gọi

### Requirement: Schema có phiên bản
Database SHALL mang số phiên bản schema. Khi mở, NightOwl SHALL tự áp mọi migration còn thiếu theo thứ tự, mỗi migration trong một transaction. Mở lại database đã ở phiên bản mới nhất SHALL không thay đổi gì.

#### Scenario: Database mới
- **WHEN** mở một database chưa có bảng nào
- **THEN** bảng `events` và `failures` tồn tại và phiên bản schema là 1

#### Scenario: Mở lại
- **WHEN** mở database đã ở phiên bản 1 lần thứ hai
- **THEN** dữ liệu và phiên bản giữ nguyên

#### Scenario: Database từ bản NightOwl mới hơn
- **WHEN** phiên bản schema trong file lớn hơn phiên bản bản NightOwl đang chạy biết
- **THEN** NightOwl không sửa file và báo lỗi yêu cầu nâng cấp NightOwl

### Requirement: Bảng events
Bảng `events` SHALL lưu mỗi sự kiện với: id tự tăng, thời điểm ghi (UTC, ISO 8601), nguồn (`claude-code` hoặc `git`), loại sự kiện, id phiên nếu có, đường dẫn file tương đối so với gốc dự án nếu có, và payload JSON.

#### Scenario: Ghi rồi đọc lại một sự kiện
- **WHEN** ghi một sự kiện nguồn `claude-code`, loại `edit`, file `src/a.ts`
- **THEN** đọc lại được đúng các trường đó, kèm id và thời điểm ghi

### Requirement: Bảng failures
Bảng `failures` SHALL tồn tại với các cột: id, thời điểm tạo, đường dẫn file, id sự kiện AI gốc, nội dung AI viết, nội dung dev commit, mã commit, loại lỗi (có thể rỗng) và trạng thái.

#### Scenario: Bảng sẵn sàng cho change sau
- **WHEN** schema v1 được tạo
- **THEN** có thể chèn một dòng `failures` với loại lỗi rỗng và trạng thái `flagged`

### Requirement: Ghi đồng thời
Hai tiến trình NightOwl ghi vào cùng database cùng lúc SHALL đều ghi thành công, không mất dòng nào và không báo lỗi database bị khoá, khi mỗi lần ghi ngắn hơn 2 giây.

#### Scenario: Hai hook chạy song song
- **WHEN** hai tiến trình mỗi bên ghi 50 sự kiện cùng lúc
- **THEN** database có đủ 100 sự kiện

### Requirement: Dùng SQLite không in cảnh báo
Mở database SHALL NOT in gì ra stdout hay stderr, kể cả cảnh báo thử nghiệm của Node.js về SQLite.

#### Scenario: Mở database trên Node.js 22.13
- **WHEN** NightOwl mở database trên Node.js 22.13
- **THEN** stderr không có `ExperimentalWarning`

### Requirement: Dữ liệu không rời khỏi máy
Lớp lưu trữ SHALL chỉ đọc và ghi file trong `.nightowl/` của dự án và SHALL NOT gửi dữ liệu đi đâu.

#### Scenario: Kiểm tra file bị chạm tới
- **WHEN** ghi một sự kiện
- **THEN** chỉ các file trong `.nightowl/` được tạo hoặc thay đổi (gồm file phụ của SQLite như `-wal`, `-shm`)

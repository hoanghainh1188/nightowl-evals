# Spec Delta

## Purpose

So code AI viết với code dev thật sự commit, ngay lúc commit, và lưu kết quả cho từng file để các change sau dựng bản ghi lỗi, mà không bao giờ làm chậm hay chặn commit.

## ADDED Requirements

### Requirement: Kiểm tra file AI đã sửa
Khi chạy `nightowl precommit`, với mỗi file staged (thêm mới hoặc sửa) có sự kiện `edit` kèm ảnh chụp chưa được kiểm tra, NightOwl SHALL so nội dung staged với ảnh chụp mới nhất của file đó và lưu một sự kiện nguồn `git`, loại `commit-check`, tham chiếu tới sự kiện `edit` đó.

#### Scenario: Dev giữ nguyên code AI
- **WHEN** AI ghi `src/a.ts`, dev stage đúng file đó không sửa gì rồi commit
- **THEN** có một sự kiện `commit-check` cho `src/a.ts` với kết quả `unchanged`

#### Scenario: Dev sửa code AI
- **WHEN** AI ghi `src/a.ts`, dev sửa 3 dòng rồi commit
- **THEN** có một sự kiện `commit-check` cho `src/a.ts` với kết quả `modified`, số dòng thêm và bớt khác 0, và nội dung staged

#### Scenario: File AI không đụng tới
- **WHEN** dev commit `README.md` mà không có sự kiện `edit` nào cho file đó
- **THEN** không có sự kiện `commit-check` nào cho `README.md`

### Requirement: Mỗi lần AI sửa chỉ kiểm tra một lần
Sự kiện `edit` đã có `commit-check` tham chiếu SHALL NOT được kiểm tra lại ở các commit sau. Một `commit-check` SHALL dùng ảnh chụp mới nhất của file và đánh dấu mọi sự kiện `edit` cũ hơn chưa kiểm tra của cùng file là đã được tính.

#### Scenario: Commit lần hai
- **WHEN** commit chứa `src/a.ts` đã được kiểm tra, rồi dev sửa tay `src/a.ts` và commit lần nữa mà AI không sửa thêm
- **THEN** commit thứ hai không tạo `commit-check` mới cho `src/a.ts`

#### Scenario: AI sửa nhiều lần trước khi commit
- **WHEN** AI sửa `src/a.ts` ba lần rồi dev commit
- **THEN** có đúng một `commit-check`, so với ảnh chụp của lần sửa thứ ba, và tham chiếu cả ba sự kiện `edit`

### Requirement: Đánh dấu thay đổi chỉ về khoảng trắng
Khi nội dung staged chỉ khác ảnh chụp ở khoảng trắng, sự kiện `commit-check` SHALL có kết quả `modified` và cờ `whitespace_only` bằng true.

#### Scenario: Dev chỉ chạy formatter
- **WHEN** dev chỉ đổi thụt lề trong file AI viết rồi commit
- **THEN** sự kiện `commit-check` có `whitespace_only` bằng true

### Requirement: Không chặn commit
`nightowl precommit` SHALL luôn thoát mã 0 và không in gì ra stdout hay stderr, kể cả khi không có database, git lỗi, hay ghi database thất bại. Lỗi SHALL chỉ được ghi vào `.nightowl/nightowl.log` khi thư mục `.nightowl/` đã tồn tại.

#### Scenario: Chưa từng chạy init
- **WHEN** chạy `nightowl precommit` trong repo chưa có `.nightowl/`
- **THEN** mã thoát 0, stdout và stderr rỗng, không file nào được tạo

#### Scenario: Database hỏng
- **WHEN** `.nightowl/nightowl.db` không phải file SQLite hợp lệ và dev commit
- **THEN** commit vẫn thành công và `.nightowl/nightowl.log` có một dòng lỗi

### Requirement: Kiểm tra nhanh
`nightowl precommit` SHALL dừng kiểm tra sau 2 giây: các file đã kiểm tra được giữ lại, phần còn lại bỏ qua, và lệnh thoát mã 0.

#### Scenario: Commit lớn
- **WHEN** commit có 500 file AI đã sửa
- **THEN** lệnh thoát mã 0 trong vòng 3 giây

### Requirement: Không lưu thông tin người
Sự kiện `commit-check` SHALL NOT chứa tên, email hay định danh của tác giả commit.

#### Scenario: Kiểm tra payload
- **WHEN** đọc một sự kiện `commit-check` bất kỳ
- **THEN** payload không có tên hay email lấy từ cấu hình git

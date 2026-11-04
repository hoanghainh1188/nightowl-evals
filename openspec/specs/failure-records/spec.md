# failure-records Specification

## Purpose
Biến kết quả kiểm tra lúc commit thành bản ghi lỗi gọn (prompt, bản AI viết, bản dev commit, mã commit), chỉ cho những commit thật sự diễn ra, làm đầu vào cho phân loại, báo cáo và bộ test.

## Requirements

### Requirement: Tạo bản ghi lỗi sau khi commit
Khi chạy `nightowl postcommit`, với mỗi `commit-check` kết quả `modified`, không phải chỉ khác khoảng trắng, chưa được xử lý, và file đó trong `HEAD` có đúng blob đã kiểm tra, NightOwl SHALL tạo một bản ghi `failures` với: đường dẫn file, sự kiện AI mới nhất, nội dung AI viết, nội dung dev commit, mã commit `HEAD`, trạng thái `flagged`, loại lỗi để trống.

#### Scenario: Dev sửa code AI rồi commit
- **WHEN** AI ghi `src/a.ts`, dev sửa rồi commit thành công
- **THEN** có đúng một bản ghi `failures` cho `src/a.ts` với `commit_sha` bằng `HEAD`, `ai_content` là bản AI viết, `final_content` là bản đã commit

#### Scenario: Dev giữ nguyên code AI
- **WHEN** `commit-check` của file có kết quả `unchanged`
- **THEN** không có bản ghi `failures` nào cho file đó

#### Scenario: Chỉ khác khoảng trắng
- **WHEN** `commit-check` có `whitespace_only` bằng true
- **THEN** không có bản ghi `failures` nào cho file đó

### Requirement: Commit bị huỷ không sinh lỗi
Một `commit-check` mà file tương ứng trong `HEAD` không có đúng blob đã kiểm tra SHALL NOT sinh bản ghi `failures`. Mỗi `commit-check` SHALL được xử lý nhiều nhất một lần.

#### Scenario: Commit bị huỷ ở bước nhập message
- **WHEN** `pre-commit` đã ghi `commit-check` `modified` nhưng commit bị huỷ, rồi dev commit lại với nội dung khác
- **THEN** bản ghi `failures` (nếu có) chỉ ứng với commit thật sự được tạo

#### Scenario: Chạy postcommit hai lần
- **WHEN** `nightowl postcommit` chạy hai lần sau cùng một commit
- **THEN** số bản ghi `failures` không đổi sau lần thứ hai

### Requirement: Gắn prompt gây ra lỗi
Bản ghi `failures` SHALL tham chiếu sự kiện `prompt` gần nhất của cùng phiên Claude Code xảy ra trước lần AI sửa đầu tiên được tính trong `commit-check`. Khi không có prompt phù hợp, tham chiếu SHALL để trống.

#### Scenario: Có prompt trong phiên
- **WHEN** người dùng gửi prompt "thêm validate email", AI sửa `src/a.ts` trong cùng phiên, dev sửa lại rồi commit
- **THEN** bản ghi `failures` tham chiếu sự kiện prompt đó

#### Scenario: Prompt của phiên khác
- **WHEN** prompt gần nhất thuộc một phiên khác với phiên AI sửa file
- **THEN** bản ghi `failures` không tham chiếu prompt đó

### Requirement: postcommit không làm phiền git
`nightowl postcommit` SHALL luôn thoát mã 0, không in gì ra stdout hay stderr, không tạo `.nightowl/` nếu chưa có, và dừng sau 2 giây. Lỗi SHALL chỉ được ghi vào `.nightowl/nightowl.log`.

#### Scenario: Database hỏng
- **WHEN** `.nightowl/nightowl.db` không phải file SQLite hợp lệ và dev commit
- **THEN** commit thành công, không có gì in ra terminal, `.nightowl/nightowl.log` có một dòng lỗi

### Requirement: Đếm bản ghi lỗi
`nightowl failures` SHALL in ra stdout tổng số bản ghi lỗi và số theo từng trạng thái, rồi thoát mã 0. Ngoài repo git, lệnh SHALL báo lỗi và thoát mã 1.

#### Scenario: Có 3 lỗi
- **WHEN** database có 3 bản ghi `failures` trạng thái `flagged`
- **THEN** stdout có tổng `3` và `flagged: 3`

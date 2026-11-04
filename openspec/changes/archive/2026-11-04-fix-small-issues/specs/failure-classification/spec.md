## ADDED Requirements

### Requirement: Không tự khởi tạo khi phân loại
`nightowl classify` SHALL NOT tạo `.nightowl/`, tạo database, hay nâng schema. Khi chưa chạy `nightowl init` hoặc database cũ, lệnh SHALL báo chạy `nightowl init`, thoát mã 1, và không gọi `claude`.

#### Scenario: Repo chưa cài
- **WHEN** chạy `nightowl classify --yes` trong repo git chưa chạy `nightowl init`
- **THEN** stderr gợi ý `nightowl init`, mã thoát là 1, không tiến trình `claude` nào được chạy, và `.nightowl/` không được tạo

### Requirement: Mỗi lúc một lần phân loại
`nightowl classify --yes` SHALL giữ một khoá trong `.nightowl/` suốt lúc chạy. Khi một tiến trình `classify --yes` khác còn sống đang giữ khoá, lệnh SHALL báo kèm PID và đường dẫn khoá, thoát mã 1, và không gọi `claude`. Khoá của tiến trình đã chết SHALL được bỏ qua và thay thế. Khoá SHALL được giải phóng khi lệnh kết thúc, kể cả khi lỗi. Chạy thử không có `--yes` không cần khoá.

#### Scenario: Hai lần chạy cùng lúc
- **WHEN** một `classify --yes` đang chạy và người dùng chạy thêm `nightowl classify --yes`
- **THEN** lần thứ hai báo đang có lần chạy khác kèm PID, thoát mã 1, và không gọi `claude`

#### Scenario: Khoá bị bỏ lại
- **WHEN** `.nightowl/classify.lock` ghi PID của một tiến trình đã kết thúc, rồi chạy `nightowl classify --yes`
- **THEN** lệnh chạy bình thường, và sau khi xong `.nightowl/classify.lock` không còn

### Requirement: Diff cho thấy thay đổi xuống dòng
Phần diff trong prompt phân loại SHALL hiện mỗi ký tự `\r` thành `␍`, để thay đổi chỉ ở xuống dòng (CRLF và LF) nhìn thấy được. Nội dung các phần khác và database SHALL không đổi.

#### Scenario: AI viết CRLF, dev lưu LF
- **WHEN** bản AI là `a\r\nb\r\n` và bản dev là `a\nb\n`
- **THEN** khối `<diff>` trong prompt có dòng `-a␍` và dòng `+a`

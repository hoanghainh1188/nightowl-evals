## MODIFIED Requirements

### Requirement: Đếm bản ghi lỗi
`nightowl failures` SHALL in ra stdout tổng số bản ghi lỗi và số theo từng trạng thái, rồi thoát mã 0. Lệnh SHALL chỉ đọc. Ngoài repo git, hoặc khi chưa chạy `nightowl init`, hoặc khi database cũ hơn phiên bản NightOwl, lệnh SHALL báo lỗi (gợi ý `nightowl init` khi phù hợp), thoát mã 1, và SHALL NOT tạo hay sửa file nào.

#### Scenario: Có 3 lỗi
- **WHEN** database có 3 bản ghi `failures` trạng thái `flagged`
- **THEN** stdout có tổng `3` và `flagged: 3`

#### Scenario: Repo chưa cài
- **WHEN** chạy `nightowl failures` trong repo git chưa chạy `nightowl init`
- **THEN** stderr gợi ý `nightowl init`, mã thoát là 1, và `.nightowl/` không được tạo

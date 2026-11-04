## MODIFIED Requirements

### Requirement: Lệnh không có tuỳ chọn từ chối tham số lạ
`nightowl init` chỉ nhận tuỳ chọn `--shared`. `nightowl failures` và `nightowl uninstall` không nhận tuỳ chọn hay tham số nào. Cả ba đều nhận thêm `-h`/`--help`. Khi có tham số khác, lệnh SHALL in ra stderr thông báo nêu tham số sai và gợi ý `nightowl <lệnh> --help`, thoát mã 1, và SHALL NOT tạo, sửa hay xoá file nào.

#### Scenario: init với tuỳ chọn gõ sai
- **WHEN** người dùng chạy `nightowl init --force` trong một repo git chưa cài NightOwl
- **THEN** stderr chứa `--force` và `--help`, mã thoát là 1, và không có `.claude/`, `.nightowl/` hay git hook nào được tạo

#### Scenario: failures với tham số thừa
- **WHEN** người dùng chạy `nightowl failures all`
- **THEN** stderr chứa `all`, mã thoát là 1, và `.nightowl/` không bị tạo

#### Scenario: uninstall với tham số thừa
- **WHEN** người dùng chạy `nightowl uninstall --all` trong repo đã cài NightOwl
- **THEN** stderr chứa `--all`, mã thoát là 1, và mọi hook NightOwl vẫn còn nguyên

## ADDED Requirements

### Requirement: Đăng ký lệnh uninstall
`nightowl` SHALL đăng ký lệnh `uninstall` với mô tả một dòng, hiện trong hướng dẫn chung, và có trợ giúp riêng qua `nightowl uninstall --help`.

#### Scenario: uninstall trong hướng dẫn chung
- **WHEN** người dùng chạy `nightowl --help`
- **THEN** stdout có một dòng bắt đầu bằng `uninstall`

# Spec Delta: cli

## MODIFIED Requirements

### Requirement: In hướng dẫn
`nightowl --help`, `nightowl help`, và `nightowl` khi không có tham số, SHALL in hướng dẫn sử dụng ra stdout rồi thoát mã 0. Hướng dẫn SHALL liệt kê mọi lệnh con đã đăng ký kèm mô tả một dòng, và SHALL có dòng gợi ý `nightowl <command> --help`.

#### Scenario: Cờ --help
- **WHEN** người dùng chạy `nightowl --help`
- **THEN** stdout chứa `init`, `log`, `report`, `export`, `doctor` và `nightowl <command> --help`, mã thoát là 0

#### Scenario: Không có tham số
- **WHEN** người dùng chạy `nightowl` không kèm tham số
- **THEN** stdout giống hệt khi chạy `nightowl --help` và mã thoát là 0

#### Scenario: Lệnh help không kèm tên lệnh
- **WHEN** người dùng chạy `nightowl help`
- **THEN** stdout giống hệt khi chạy `nightowl --help` và mã thoát là 0

#### Scenario: help kèm cờ trợ giúp
- **WHEN** người dùng chạy `nightowl help --help` hoặc `nightowl help help`
- **THEN** stdout giống hệt khi chạy `nightowl --help` và mã thoát là 0

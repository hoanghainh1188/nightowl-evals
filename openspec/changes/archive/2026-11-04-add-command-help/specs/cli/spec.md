## MODIFIED Requirements

### Requirement: In hướng dẫn
`nightowl --help`, `nightowl help`, và `nightowl` khi không có tham số, SHALL in hướng dẫn sử dụng ra stdout rồi thoát mã 0. Hướng dẫn SHALL liệt kê mọi lệnh con đã đăng ký kèm mô tả một dòng, và SHALL có dòng gợi ý `nightowl <command> --help`.

#### Scenario: Cờ --help
- **WHEN** người dùng chạy `nightowl --help`
- **THEN** stdout chứa `init`, `log`, `report`, `export` và `nightowl <command> --help`, mã thoát là 0

#### Scenario: Không có tham số
- **WHEN** người dùng chạy `nightowl` không kèm tham số
- **THEN** stdout giống hệt khi chạy `nightowl --help` và mã thoát là 0

#### Scenario: Lệnh help không kèm tên lệnh
- **WHEN** người dùng chạy `nightowl help`
- **THEN** stdout giống hệt khi chạy `nightowl --help` và mã thoát là 0

#### Scenario: help kèm cờ trợ giúp
- **WHEN** người dùng chạy `nightowl help --help` hoặc `nightowl help help`
- **THEN** stdout giống hệt khi chạy `nightowl --help` và mã thoát là 0

## ADDED Requirements

### Requirement: Trợ giúp cho từng lệnh
Với mọi lệnh con đã đăng ký, khi `-h` hoặc `--help` có ở bất kỳ vị trí nào trong các tham số sau tên lệnh (kể cả ở chỗ giá trị của tuỳ chọn khác, hoặc sau `--`), `nightowl` SHALL in trợ giúp của lệnh đó ra stdout rồi thoát mã 0, và SHALL NOT chạy lệnh. Không file, database hay hook nào bị tạo hoặc sửa, và không dữ liệu nào được gửi đi. Trợ giúp SHALL gồm cách gọi, mô tả ngắn, và mọi tuỳ chọn lệnh nhận được kèm giá trị mặc định nếu có.

#### Scenario: init --help không cài gì
- **WHEN** người dùng chạy `nightowl init --help` trong một repo git chưa cài NightOwl
- **THEN** stdout chứa `Usage: nightowl init`, mã thoát là 0, và không có `.claude/settings.json`, `.nightowl/` hay git hook nào được tạo

#### Scenario: Tuỳ chọn của lệnh hiện trong trợ giúp
- **WHEN** người dùng chạy `nightowl eval --help`
- **THEN** stdout chứa `--yes`, `--input`, `--model`, `--limit` cùng giá trị mặc định, mã thoát là 0, và `claude` không được gọi

#### Scenario: Cờ ngắn -h
- **WHEN** người dùng chạy `nightowl report -h`
- **THEN** stdout giống hệt khi chạy `nightowl report --help` và mã thoát là 0

#### Scenario: --help đứng sau tuỳ chọn khác
- **WHEN** người dùng chạy `nightowl export --since 2026-01-01 --help`
- **THEN** stdout là trợ giúp của `export`, mã thoát là 0, và không file export nào được ghi

#### Scenario: Trợ giúp của lệnh hook
- **WHEN** người dùng chạy `nightowl log --help`
- **THEN** stdout là trợ giúp của `log`, nêu rằng lệnh do hook gọi, mã thoát là 0, và lệnh không đọc stdin

### Requirement: Lệnh help với tên lệnh
`nightowl help <lệnh>` SHALL cho cùng stdout và mã thoát như `nightowl <lệnh> --help`. Khi tên lệnh không tồn tại, `nightowl help` SHALL xử lý giống như gõ sai tên lệnh.

#### Scenario: help kèm tên lệnh
- **WHEN** người dùng chạy `nightowl help classify`
- **THEN** stdout giống hệt khi chạy `nightowl classify --help` và mã thoát là 0

#### Scenario: help kèm tên lệnh sai
- **WHEN** người dùng chạy `nightowl help reprot`
- **THEN** stderr chứa `reprot` và `--help`, stdout rỗng, mã thoát là 1

### Requirement: Lệnh không có tuỳ chọn từ chối tham số lạ
`nightowl init` và `nightowl failures` không nhận tuỳ chọn hay tham số nào ngoài `-h`/`--help`. Khi có tham số khác, lệnh SHALL in ra stderr thông báo nêu tham số sai và gợi ý `nightowl <lệnh> --help`, thoát mã 1, và SHALL NOT tạo hay sửa file nào.

#### Scenario: init với tuỳ chọn gõ sai
- **WHEN** người dùng chạy `nightowl init --force` trong một repo git chưa cài NightOwl
- **THEN** stderr chứa `--force` và `--help`, mã thoát là 1, và không có `.claude/settings.json`, `.nightowl/` hay git hook nào được tạo

#### Scenario: failures với tham số thừa
- **WHEN** người dùng chạy `nightowl failures all`
- **THEN** stderr chứa `all`, mã thoát là 1, và `.nightowl/` không bị tạo

### Requirement: Lệnh hook bỏ qua tham số lạ
`nightowl log`, `nightowl precommit` và `nightowl postcommit` SHALL bỏ qua mọi tham số khác `-h`/`--help`, và SHALL giữ hành vi thoát mã 0 mà không in gì.

#### Scenario: precommit với tham số lạ
- **WHEN** git hook chạy `nightowl precommit --unknown`
- **THEN** lệnh thoát mã 0 và stdout, stderr đều rỗng

## REMOVED Requirements

### Requirement: Lệnh con chưa triển khai
**Reason**: `report` và `export` đã có logic từ tuần 3; spec `failure-report` và `eval-export` mô tả hành vi thật của chúng.
**Migration**: Không cần. Không lệnh nào còn ở trạng thái chưa triển khai.

# cli Specification

## Purpose
Lệnh `nightowl` là điểm vào duy nhất của NightOwl Evals: chuyển tới lệnh con, in hướng dẫn và phiên bản, và trả mã thoát rõ ràng để người dùng, hook và script dựa vào được.

## Requirements

### Requirement: Cài đặt lệnh nightowl
Package `@hoanghainh/nightowl-evals` SHALL cung cấp một file thực thi tên `nightowl` khi được cài qua npm, chạy được trên Node.js 22.13 trở lên.

#### Scenario: Gọi bin sau khi cài
- **WHEN** người dùng cài package và chạy `nightowl --version`
- **THEN** lệnh chạy được và thoát mã 0

### Requirement: In phiên bản
`nightowl --version` SHALL in đúng chuỗi phiên bản trong `package.json` ra stdout, theo sau là một ký tự xuống dòng, và thoát mã 0.

#### Scenario: Cờ --version
- **WHEN** người dùng chạy `nightowl --version`
- **THEN** stdout chỉ chứa phiên bản của package (ví dụ `0.1.0`) và mã thoát là 0

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

### Requirement: Lệnh con không tồn tại
Khi lệnh con không có trong danh sách đăng ký, `nightowl` SHALL in ra stderr một thông báo nêu tên lệnh sai và gợi ý `nightowl --help`, không in gì ra stdout, và thoát mã 1.

#### Scenario: Gõ sai tên lệnh
- **WHEN** người dùng chạy `nightowl reprot`
- **THEN** stderr chứa `reprot` và `--help`, stdout rỗng, mã thoát là 1

### Requirement: Lệnh log không bao giờ chặn hook
`nightowl log` SHALL đọc hết stdin rồi thoát mã 0, không in gì ra stdout hay stderr, kể cả khi stdin rỗng, không phải JSON, hoặc bị lỗi khi đọc.

#### Scenario: stdin là JSON hợp lệ
- **WHEN** một JSON payload được pipe vào `nightowl log`
- **THEN** lệnh thoát mã 0 và stdout, stderr đều rỗng

#### Scenario: stdin không hợp lệ
- **WHEN** chuỗi `not json` được pipe vào `nightowl log`
- **THEN** lệnh thoát mã 0 và stdout, stderr đều rỗng

#### Scenario: Không có stdin
- **WHEN** `nightowl log` chạy với stdin đã đóng và rỗng
- **THEN** lệnh thoát mã 0 trong vòng 1 giây

#### Scenario: stdin không bao giờ đóng
- **WHEN** `nightowl log` chạy với stdin là một pipe còn mở nhưng không gửi EOF
- **THEN** lệnh bỏ phần chưa đọc, thoát mã 0 trong vòng 1 giây, và stdout, stderr đều rỗng

### Requirement: Không crash khi pipe đầu ra bị đóng
Khi stdout hoặc stderr bị đóng sớm (ví dụ `nightowl --help | head -c 0`), `nightowl` SHALL NOT in stack trace và SHALL giữ mã thoát của lệnh.

#### Scenario: Người đọc đóng stdout
- **WHEN** chạy `nightowl --help` và stdout bị đóng trước khi lệnh ghi xong
- **THEN** lệnh thoát mã 0 và stderr rỗng

### Requirement: Không truy cập mạng
Lệnh `nightowl` và mọi lệnh con SHALL NOT mở kết nối mạng hay gửi dữ liệu ra khỏi máy.

#### Scenario: Chạy khi không có mạng
- **WHEN** chạy `nightowl --help`, `nightowl --version` và từng lệnh con trên máy không có mạng
- **THEN** mọi lệnh cho kết quả và mã thoát giống như khi có mạng

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

### Requirement: Lệnh hook bỏ qua tham số lạ
`nightowl log`, `nightowl precommit` và `nightowl postcommit` SHALL bỏ qua mọi tham số khác `-h`/`--help`, và SHALL giữ hành vi thoát mã 0 mà không in gì.

#### Scenario: precommit với tham số lạ
- **WHEN** git hook chạy `nightowl precommit --unknown`
- **THEN** lệnh thoát mã 0 và stdout, stderr đều rỗng

### Requirement: Đăng ký lệnh uninstall
`nightowl` SHALL đăng ký lệnh `uninstall` với mô tả một dòng, hiện trong hướng dẫn chung, và có trợ giúp riêng qua `nightowl uninstall --help`.

#### Scenario: uninstall trong hướng dẫn chung
- **WHEN** người dùng chạy `nightowl --help`
- **THEN** stdout có một dòng bắt đầu bằng `uninstall`

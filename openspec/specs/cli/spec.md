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
`nightowl --help`, và `nightowl` khi không có tham số, SHALL in hướng dẫn sử dụng ra stdout, liệt kê mọi lệnh con đã đăng ký kèm mô tả một dòng, rồi thoát mã 0.

#### Scenario: Cờ --help
- **WHEN** người dùng chạy `nightowl --help`
- **THEN** stdout chứa `init`, `log`, `report`, `export` và mã thoát là 0

#### Scenario: Không có tham số
- **WHEN** người dùng chạy `nightowl` không kèm tham số
- **THEN** stdout giống hệt khi chạy `nightowl --help` và mã thoát là 0

### Requirement: Lệnh con không tồn tại
Khi lệnh con không có trong danh sách đăng ký, `nightowl` SHALL in ra stderr một thông báo nêu tên lệnh sai và gợi ý `nightowl --help`, không in gì ra stdout, và thoát mã 1.

#### Scenario: Gõ sai tên lệnh
- **WHEN** người dùng chạy `nightowl reprot`
- **THEN** stderr chứa `reprot` và `--help`, stdout rỗng, mã thoát là 1

### Requirement: Lệnh con chưa triển khai
Các lệnh `init`, `report`, `export` SHALL được đăng ký. Khi chưa có logic, mỗi lệnh SHALL in ra stderr một dòng báo lệnh chưa được triển khai, không thay đổi file nào, và thoát mã 0.

#### Scenario: Gọi lệnh report khi chưa triển khai
- **WHEN** người dùng chạy `nightowl report`
- **THEN** stderr báo `report` chưa được triển khai, không file nào trong thư mục hiện tại bị tạo hoặc sửa, mã thoát là 0

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

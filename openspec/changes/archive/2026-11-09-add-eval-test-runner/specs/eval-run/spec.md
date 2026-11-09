## ADDED Requirements

### Requirement: Opt-in chạy lệnh kiểm thử sau mỗi đầu ra model
Với `--test-command <cmd>` và `--yes`, sau mỗi đầu ra file hợp lệ NightOwl SHALL ghi nội dung vào `filePath` của bài tại project root, chạy `<cmd>` với cwd là project root, rồi khôi phục file. Không có `--test-command` thì không chạy shell test. Không có `--yes` thì SHALL NOT chạy test.

#### Scenario: Dry-run có test command
- **WHEN** chạy `nightowl eval --test-command "npm test"` không có `--yes`
- **THEN** stdout nêu lệnh test sẽ dùng; không tiến trình model và không tiến trình test nào chạy; mã thoát 0

#### Scenario: Chạy test sau đầu ra hợp lệ
- **WHEN** chạy `nightowl eval --yes --test-command "npm test"` và model trả file hợp lệ
- **THEN** NightOwl ghi file, chạy `npm test` tại project root, khôi phục file, và ghi kết quả test vào dòng JSONL của bài đó

#### Scenario: Không có --test-command
- **WHEN** chạy `nightowl eval --yes` không có `--test-command`
- **THEN** không lệnh shell kiểm thử nào được chạy; điểm textual giữ như hiện tại

### Requirement: Timeout và tuần tự hoá khi chạy test
Mỗi lần `--test-command` SHALL bị huỷ sau `--test-timeout` giây (mặc định 120, min 1, max 600). Khi có `--test-command`, bài/model SHALL chạy tuần tự. Timeout hoặc crash SHALL ghi test không đạt; các bài khác vẫn chạy.

#### Scenario: Test treo
- **WHEN** lệnh test không kết thúc trong thời gian timeout
- **THEN** tiến trình test bị huỷ, kết quả test của bài là không đạt kèm lý do timeout, file được khôi phục, các bài còn lại vẫn chạy

### Requirement: Ghi kết quả execution vào JSONL
Mỗi dòng JSONL SHALL gồm `tests_passed` (boolean hoặc null), `tests_exit_code` (số hoặc null), và `tests_error` (chuỗi ngắn hoặc null). Điểm textual (`coverage`, `repeat`, `score`) SHALL giữ công thức hiện tại.

#### Scenario: Model sửa khác expected nhưng test xanh
- **WHEN** có `--test-command`, điểm textual < 0,5, lệnh test thoát 0, không có `--require-tests`
- **THEN** `pass` textual là false; `tests_passed` là true; stdout/JSONL phản ánh cả hai

### Requirement: Tuỳ chọn --require-tests gắn pass tổng
Với `--require-tests`, `pass` SHALL chỉ true khi điểm textual đạt và `tests_passed` là true. Không có cờ thì `pass` giữ công thức textual. `--require-tests` thiếu `--test-command` SHALL thoát mã 1 trước khi gọi model.

#### Scenario: require-tests
- **WHEN** chạy với `--test-command` và `--require-tests`, điểm textual ≥ 0,5 nhưng test thoát mã khác 0
- **THEN** `pass` là false

#### Scenario: require-tests thiếu test-command
- **WHEN** chạy `nightowl eval --yes --require-tests` không có `--test-command`
- **THEN** stderr báo lỗi, mã thoát 1, không gọi model

### Requirement: Khôi phục file an toàn
Trước khi ghi, NightOwl SHALL backup nội dung file đích (hoặc ghi nhận chưa tồn tại). Sau test (ok/fail/timeout) SHALL restore backup, kể cả khi test lỗi. Restore thất bại SHALL báo lỗi, thoát mã 1, và không tiếp tục ghi đè im lặng.

#### Scenario: Test fail vẫn khôi phục
- **WHEN** lệnh test thoát mã 1
- **THEN** nội dung file trên disk sau bài đó giống như trước khi ghi đầu ra model

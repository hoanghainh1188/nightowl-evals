# Spec Delta

## MODIFIED Requirements

### Requirement: Patch và trường harness SWE-bench
`patch` SHALL là unified diff từ `file_before` (hoặc `rejected`) tới `expected`. `base_commit` SHALL từ git khi có, hoặc `null`. Không có stub harness đã document thì `FAIL_TO_PASS`/`PASS_TO_PASS` rỗng và `test_patch` rỗng; có stub khớp thì điền theo convention, `PASS_TO_PASS` vẫn rỗng. SHALL NOT bịa test id khi thiếu stub.

#### Scenario: Diff từ file_before sang expected
- **WHEN** `file_before` là `a` và `expected` là `b` cho cùng `file_path`
- **THEN** `patch` là unified diff thể hiện thay đổi đó

#### Scenario: Harness rỗng
- **WHEN** xuất swe-bench mà không có thư mục regression, hoặc không có stub NightOwl khớp `instance_id`
- **THEN** `FAIL_TO_PASS` và `PASS_TO_PASS` là list rỗng và `test_patch` là chuỗi rỗng (không bịa test id)

#### Scenario: Harness điền từ stub khớp
- **WHEN** xuất swe-bench với thư mục regression chứa stub NightOwl khớp `instance_id` của failure
- **THEN** `FAIL_TO_PASS` không rỗng theo convention đã document, `test_patch` là unified diff thêm stub đó, và `PASS_TO_PASS` vẫn là list rỗng

## ADDED Requirements

### Requirement: Tuỳ chọn thư mục regression cho swe-bench
`nightowl export --format swe-bench` SHALL chấp nhận tuỳ chọn tường minh chỉ đường dẫn thư mục chứa artifact `suggest-regressions` (ví dụ `--regressions-dir <dir>`). Chỉ định dạng swe-bench SHALL dùng tuỳ chọn này để điền harness. Thiếu tuỳ chọn SHALL giữ harness rỗng. Đường dẫn không tồn tại hoặc không phải thư mục SHALL làm lệnh báo lỗi trên stderr và thoát mã khác 0 mà không ghi file. Lệnh SHALL NOT gọi mạng hay chạy test runner.

#### Scenario: Có --regressions-dir hợp lệ
- **WHEN** chạy `nightowl export --format swe-bench --regressions-dir <dir>` với `<dir>` là thư mục tồn tại
- **THEN** lệnh dùng artifact NightOwl trong đó để điền harness khi khớp; mã thoát 0 nếu xuất thành công như các quy tắc export hiện có

#### Scenario: Thiếu --regressions-dir
- **WHEN** chạy `nightowl export --format swe-bench` không chỉ thư mục regression
- **THEN** mọi dòng vẫn xuất được với harness rỗng (tương thích hành vi trước)

#### Scenario: Đường dẫn regression không hợp lệ
- **WHEN** `--regressions-dir` trỏ tới path không tồn tại hoặc không phải thư mục
- **THEN** stderr báo lỗi; thoát mã khác 0; không ghi file xuất

### Requirement: Khớp stub theo eval id ổn định
Khi điền harness, export SHALL chỉ nhận file stub NightOwl đã biết (cùng marker / quy ước `suggest-regressions`) có tên gắn đúng `instance_id` (= eval id ổn định của failure). File không phải artifact NightOwl hoặc không khớp id SHALL bị bỏ qua (không lỗi cả lệnh). Chỉ fixture JSON mà không có stub khớp SHALL NOT điền `FAIL_TO_PASS` / `test_patch`.

#### Scenario: Stub khớp id
- **WHEN** thư mục có stub NightOwl tên gắn `instance_id` của failure đang xuất
- **THEN** dòng swe-bench tương ứng dùng stub đó cho harness

#### Scenario: Chỉ có fixture JSON
- **WHEN** thư mục chỉ có file fixture JSON NightOwl khớp id, không có stub test khớp
- **THEN** `FAIL_TO_PASS` vẫn rỗng và `test_patch` vẫn rỗng cho instance đó

#### Scenario: File lạ cùng thư mục
- **WHEN** thư mục chứa file không phải artifact NightOwl hoặc tên không khớp id
- **THEN** export bỏ qua file đó; không lấy nội dung làm `FAIL_TO_PASS` / `test_patch`

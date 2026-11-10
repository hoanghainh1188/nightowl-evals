# Spec Delta

## ADDED Requirements

### Requirement: Chọn định dạng xuất
`nightowl export` SHALL chấp nhận `--format <jsonl|swe-bench|promptfoo>`. Mặc định SHALL là `jsonl` (hành vi JSONL `nightowl.eval/v1` hiện có). Giá trị không hợp lệ SHALL làm lệnh báo lỗi trên stderr và thoát mã 1 mà không ghi file.

#### Scenario: Mặc định jsonl
- **WHEN** chạy `nightowl export` không có `--format`
- **THEN** file xuất là JSONL schema `nightowl.eval/v1` như trước

#### Scenario: Format không hợp lệ
- **WHEN** chạy `nightowl export --format parquet`
- **THEN** stderr nêu format không hỗ trợ, mã thoát 1, không ghi file

### Requirement: Xuất định dạng SWE-bench tương thích
Với `--format swe-bench`, mỗi bản ghi đủ điều kiện xuất SHALL thành một dòng JSON (JSONL) với các trường cốt lõi: `instance_id`, `repo`, `base_commit`, `problem_statement`, `patch`, `test_patch`, `created_at`. Lệnh SHALL NOT gọi mạng.

#### Scenario: Map một failure có commit và file_before
- **WHEN** failure có `commit_sha`, `file_before` khác null, và `expected`
- **THEN** dòng xuất có `instance_id` ổn định, `base_commit` không rỗng, `patch` chứa hunk unified diff, và không HTTP

#### Scenario: Thiếu ngữ cảnh git
- **WHEN** failure không có `commit_sha` dùng được
- **THEN** vẫn xuất được dòng với `base_commit` null (hoặc tương đương đã document) và `problem_statement` / `patch` từ dữ liệu local

### Requirement: Patch và trường harness SWE-bench
`patch` SHALL là unified diff từ nội dung trước sửa (`file_before` nếu có, không thì `rejected`) tới `expected`. `base_commit` SHALL lấy từ git khi có, hoặc `null` nếu không xác định. Trường harness không suy ra được (`FAIL_TO_PASS`, `PASS_TO_PASS`, …) SHALL là list rỗng theo convention đã document.

#### Scenario: Diff từ file_before sang expected
- **WHEN** `file_before` là `a` và `expected` là `b` cho cùng `file_path`
- **THEN** `patch` là unified diff thể hiện thay đổi đó

#### Scenario: Harness rỗng
- **WHEN** xuất swe-bench bất kỳ failure nào
- **THEN** `FAIL_TO_PASS` và `PASS_TO_PASS` là list rỗng (không bịa test id)

### Requirement: Xuất cấu hình Promptfoo
Với `--format promptfoo`, lệnh SHALL ghi một file cấu hình Promptfoo (YAML) dùng được với CLI Promptfoo: có `prompts`, `providers` (placeholder hoặc comment hướng dẫn điền), và `tests` — mỗi failure một test với vars (file/path/prompt) và assert hướng tới `expected` (ví dụ `equals` hoặc tương đương an toàn). Lệnh SHALL NOT chạy Promptfoo hay gọi API model.

#### Scenario: Xuất promptfoo từ vài failure
- **WHEN** có ≥1 failure đủ điều kiện và chạy `nightowl export --format promptfoo --out .nightowl/export/promptfooconfig.yaml`
- **THEN** file YAML tồn tại, parse được cấu trúc prompts/tests, mã thoát 0

#### Scenario: Promptfoo không gửi dữ liệu
- **WHEN** chạy `nightowl export --format promptfoo`
- **THEN** không mở kết nối mạng; chỉ ghi file local

### Requirement: Đường dẫn mặc định theo format
Khi không có `--out`, đường dẫn mặc định SHALL phụ thuộc format: `jsonl` → `.nightowl/export/evals.jsonl`; `swe-bench` → `.nightowl/export/swe-bench.jsonl`; `promptfoo` → `.nightowl/export/promptfooconfig.yaml`. Các quy tắc ghi an toàn / `--force` / sensitive / filter `--since` `--category` SHALL áp dụng như export hiện có.

#### Scenario: Mặc định swe-bench
- **WHEN** `nightowl export --format swe-bench` không `--out`
- **THEN** ghi `.nightowl/export/swe-bench.jsonl` (tạo thư mục nếu cần theo rule hiện có)

## MODIFIED Requirements

### Requirement: Xuất bộ test JSONL
`nightowl export` SHALL, khi `--format` là `jsonl` (mặc định), ghi một dòng JSON cho mỗi bản ghi lỗi không bị `dismissed`, theo thứ tự tạo, với các trường: `schema` (bằng `nightowl.eval/v1`), `id`, `file_path`, `commit_sha`, `created_at`, `input.prompt`, `input.file_before`, `rejected`, `expected`, `category`, `category_reason`, `category_confidence`, `criteria`. Sau khi ghi, lệnh SHALL in ra stderr số bài test và đường dẫn file, rồi thoát mã 0. Với `--format` khác, stderr vẫn SHALL báo số bản ghi đã xuất và đường dẫn tương ứng.

#### Scenario: Hai lỗi
- **WHEN** database có 2 bản ghi lỗi và chạy `nightowl export`
- **THEN** `.nightowl/export/evals.jsonl` có đúng 2 dòng, mỗi dòng là JSON hợp lệ với `schema` bằng `nightowl.eval/v1`, `rejected` là bản AI viết và `expected` là bản dev commit

#### Scenario: Lỗi bị loại
- **WHEN** một bản ghi lỗi có trạng thái `dismissed`
- **THEN** bản ghi đó không có trong file xuất

#### Scenario: Chưa có lỗi
- **WHEN** database chưa có bản ghi lỗi nào
- **THEN** file xuất rỗng và stderr báo đã xuất 0 bài test, mã thoát 0

# eval-export Specification

## Purpose
Biến mỗi bản ghi lỗi thành một bài test (đầu vào, code đúng, tiêu chí chấm) trong một file JSONL nằm trên máy, để chạy lại với các model khác nhau.

## Requirements

### Requirement: Xuất bộ test JSONL
`nightowl export` SHALL, khi `--format` là `jsonl` (mặc định), ghi một dòng JSON cho mỗi bản ghi lỗi không `dismissed` (theo thứ tự tạo) với `schema` `nightowl.eval/v1`, `id`, `file_path`, `commit_sha`, `created_at`, `input.prompt`, `input.file_before`, `rejected`, `expected`, `category`, `category_reason`, `category_confidence`, `criteria`. Sau khi ghi, stderr SHALL báo số bài test và đường dẫn, rồi thoát mã 0. Format khác cũng SHALL báo số bản ghi và đường dẫn trên stderr.

#### Scenario: Hai lỗi
- **WHEN** database có 2 bản ghi lỗi và chạy `nightowl export`
- **THEN** `.nightowl/export/evals.jsonl` có đúng 2 dòng, mỗi dòng là JSON hợp lệ với `schema` bằng `nightowl.eval/v1`, `rejected` là bản AI viết và `expected` là bản dev commit

#### Scenario: Lỗi bị loại
- **WHEN** một bản ghi lỗi có trạng thái `dismissed`
- **THEN** bản ghi đó không có trong file xuất

#### Scenario: Chưa có lỗi
- **WHEN** database chưa có bản ghi lỗi nào
- **THEN** file xuất rỗng và stderr báo đã xuất 0 bài test, mã thoát 0

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
`patch` SHALL là unified diff từ nội dung trước sửa (`file_before` nếu có, không thì `rejected`) tới `expected`. `base_commit` SHALL lấy từ git khi có, hoặc `null` nếu không xác định. Khi không có nguồn harness local đã document, `FAIL_TO_PASS` / `PASS_TO_PASS` SHALL là list rỗng và `test_patch` SHALL là chuỗi rỗng. Khi có stub NightOwl khớp (xem requirement nguồn harness), `FAIL_TO_PASS` và `test_patch` SHALL được điền theo convention đã document; `PASS_TO_PASS` vẫn SHALL là list rỗng. Lệnh SHALL NOT bịa test id khi thiếu stub.

#### Scenario: Diff từ file_before sang expected
- **WHEN** `file_before` là `a` và `expected` là `b` cho cùng `file_path`
- **THEN** `patch` là unified diff thể hiện thay đổi đó

#### Scenario: Harness rỗng
- **WHEN** xuất swe-bench mà không có thư mục regression, hoặc không có stub NightOwl khớp `instance_id`
- **THEN** `FAIL_TO_PASS` và `PASS_TO_PASS` là list rỗng và `test_patch` là chuỗi rỗng (không bịa test id)

#### Scenario: Harness điền từ stub khớp
- **WHEN** xuất swe-bench với thư mục regression chứa stub NightOwl khớp `instance_id` của failure
- **THEN** `FAIL_TO_PASS` không rỗng theo convention đã document, `test_patch` là unified diff thêm stub đó, và `PASS_TO_PASS` vẫn là list rỗng

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

### Requirement: Đầu vào gồm file trước commit
`input.file_before` SHALL là nội dung file tại commit cha của `commit_sha`, đọc từ git trên máy. Khi file chưa tồn tại ở commit cha, commit không còn trong repo, nội dung lớn hơn 512 KB, hoặc nội dung không phải văn bản UTF-8 (file nhị phân), `input.file_before` SHALL là `null`. `input.prompt` SHALL là prompt gắn với bản ghi lỗi, hoặc `null`.

#### Scenario: File có sẵn trước đó
- **WHEN** file `src/a.ts` đã có ở commit cha với nội dung `v0`, AI viết `v1`, dev commit `v2`
- **THEN** bài test có `input.file_before` bằng `v0`, `rejected` bằng `v1`, `expected` bằng `v2`

#### Scenario: File mới
- **WHEN** commit có lỗi là commit tạo ra file đó
- **THEN** `input.file_before` là `null`

### Requirement: Định danh ổn định
`id` SHALL được dựng từ mã commit và số của bản ghi lỗi, chỉ phụ thuộc vào chính bản ghi đó, để xuất lại (kể cả với bộ lọc khác, hay sau khi có bản ghi khác bị loại) luôn cho cùng `id`.

#### Scenario: Xuất hai lần
- **WHEN** chạy `nightowl export` hai lần không có lỗi mới
- **THEN** hai file giống hệt nhau

#### Scenario: Xuất với bộ lọc khác
- **WHEN** một bản ghi lỗi có trong cả lần xuất đầy đủ và lần xuất `--category convention`
- **THEN** `id` của nó giống nhau ở hai lần

### Requirement: Ghi file an toàn
Mặc định lệnh SHALL ghi vào `.nightowl/export/evals.jsonl`. File xuất SHALL được tạo với quyền chỉ chủ sở hữu đọc ghi, ghi nguyên tử (không để lại file dở khi lỗi), và SHALL NOT ghi xuyên symlink. Lệnh SHALL NOT thay thế một file có sẵn không phải file xuất trước đó của NightOwl, trừ khi có `--force`. Khi git không bỏ qua file đích, lệnh SHALL cảnh báo trên stderr. Với `--out -`, lệnh SHALL in JSONL ra stdout và không tạo file.

#### Scenario: Đích là file khác
- **WHEN** chạy `nightowl export --out notes.txt` và `notes.txt` là ghi chú của người dùng
- **THEN** lệnh báo lỗi gợi ý `--force`, thoát mã 1, `notes.txt` không đổi

#### Scenario: Đích là symlink
- **WHEN** `--out` trỏ tới một symlink
- **THEN** lệnh báo lỗi, thoát mã 1, file mà symlink trỏ tới không đổi

### Requirement: Không xuất file nhạy cảm
Lệnh SHALL NOT xuất bản ghi lỗi của file có tên thuộc nhóm bí mật (cùng quy tắc với hook Claude Code: `.env*`, khoá, `credentials`, …) hoặc bản ghi mà nội dung code chứa secret inline, kể cả khi database có sẵn bản ghi đó, và SHALL báo trên stderr số bản ghi đã bỏ.

#### Scenario: Bản ghi lỗi của .env
- **WHEN** database có một bản ghi lỗi cho `.env`
- **THEN** file xuất không có bản ghi đó và stderr báo đã bỏ 1 bản ghi nhạy cảm

#### Scenario: Bản ghi lỗi chứa secret inline
- **WHEN** database có bản ghi lỗi mà `rejected` hoặc `expected` chứa private key hoặc API token
- **THEN** file xuất không có bản ghi đó và được đếm là bản ghi nhạy cảm bị bỏ qua

### Requirement: Lọc khi xuất
Với `--since <YYYY-MM-DD>`, lệnh SHALL chỉ xuất bản ghi lỗi tạo từ 00:00 UTC ngày đó. Với một hoặc nhiều `--category <loại>`, lệnh SHALL chỉ xuất bản ghi thuộc các loại đó; giá trị `unclassified` chọn bản ghi chưa có loại. Giá trị không hợp lệ SHALL làm lệnh báo lỗi và thoát mã 1 mà không ghi file.

#### Scenario: Chỉ lỗi logic
- **WHEN** chạy `nightowl export --category logic` với 2 lỗi `logic` và 1 lỗi `convention`
- **THEN** file xuất có 2 dòng

### Requirement: Chỉ đọc dữ liệu, không tự khởi tạo
`nightowl export` SHALL mở database chỉ đọc và SHALL NOT thay đổi hay nâng cấp nó; database cũ hơn phiên bản hiện tại SHALL làm lệnh gợi ý `nightowl init` và thoát mã 1. Khi dự án chưa có `.nightowl/nightowl.db`, lệnh SHALL báo cần chạy `nightowl init`, thoát mã 1 và SHALL NOT tạo file hay thư mục nào. Ngoài repo git, lệnh SHALL báo lỗi và thoát mã 1.

#### Scenario: Chưa chạy init
- **WHEN** chạy `nightowl export` trong một repo git chưa có `.nightowl/`
- **THEN** stderr gợi ý `nightowl init`, mã thoát 1, không có `.nightowl/` được tạo

### Requirement: Xuất nguồn lỗi và prompt phản hồi
Mỗi dòng `nightowl export` SHALL có thêm trường `source` (nguồn của lỗi) và `input.feedback` (nội dung prompt phản hồi, `null` khi không có). `schema` vẫn là `nightowl.eval/v1` và `id` không đổi. `nightowl eval` SHALL NOT gửi `input.feedback` cho model.

#### Scenario: Lỗi AI tự sửa
- **WHEN** xuất một lỗi `ai-self-fix` có prompt phản hồi "sai rồi, từ 18"
- **THEN** dòng tương ứng có `source` là `ai-self-fix` và `input.feedback` là "sai rồi, từ 18"

#### Scenario: Lỗi sửa tay
- **WHEN** xuất một lỗi `manual-fix`
- **THEN** dòng tương ứng có `source` là `manual-fix` và `input.feedback` là `null`

#### Scenario: Eval không lộ gợi ý
- **WHEN** chạy `nightowl eval --yes` trên một ca có `input.feedback`
- **THEN** prompt gửi cho model không chứa nội dung của `input.feedback`

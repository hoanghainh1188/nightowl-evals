# eval-run Specification

## Purpose
Chạy lại bộ test lấy từ lỗi thật của dự án với nhiều model, chấm điểm tự động và so sánh, để biết model nào sai ít hơn trên chính code base đó.

## Requirements

### Requirement: Tắt mặc định, chỉ gửi khi xác nhận
`nightowl eval` không có `--yes` SHALL NOT gửi dữ liệu tới bất kỳ model nào. Lệnh SHALL in số bài test sẽ chạy, số bài bị bỏ qua theo lý do, các model, tổng số lời gọi, dung lượng ước tính, danh sách file có nội dung sẽ bị gửi, và dòng lệnh để chạy thật, rồi thoát mã 0.

#### Scenario: Chạy thử
- **WHEN** bộ test có 5 bài hợp lệ và chạy `nightowl eval`
- **THEN** stdout cho biết 5 bài, model `haiku` và `sonnet`, 10 lời gọi, và cách chạy với `--yes`; không tiến trình `claude` nào được chạy; không file nào được tạo trong `.nightowl/runs/`

### Requirement: Chạy bộ test với nhiều model
Với `--yes`, cho mỗi bài test hợp lệ (tối đa `--limit`, mặc định 20, tối đa 100, theo thứ tự trong file) và mỗi model (`--model`, mặc định `haiku` và `sonnet`), NightOwl SHALL gửi đường dẫn file, prompt của dev và nội dung file trước commit, nhận lại toàn bộ nội dung file mới, rồi chấm điểm.

#### Scenario: Hai model
- **WHEN** chạy `nightowl eval --yes` với 3 bài hợp lệ
- **THEN** có 6 lời gọi `claude`, mỗi lời gọi đúng một model, và mỗi bài có điểm cho cả hai model

#### Scenario: Bài không chạy được
- **WHEN** một bài có `input.prompt` là `null`, prompt hoặc `input.file_before` lớn hơn 64 KB, file thuộc nhóm nhạy cảm (`.env*`, khoá, …), `expected` và `rejected` không khác dòng nào sau khi chuẩn hoá, hoặc trùng `id` với bài trước
- **THEN** bài đó không được gửi và được đếm là bị bỏ qua theo lý do

### Requirement: Chấm điểm tự động
Điểm của một đầu ra SHALL được tính không dùng LLM: điểm = độ phủ × (1 − độ lặp lỗi), trong khoảng 0–1, với độ phủ là tỷ lệ dòng dev thêm vào (có trong `expected` mà không có trong `rejected`) xuất hiện trong đầu ra, và độ lặp lỗi là tỷ lệ dòng dev đã xoá (có trong `rejected` mà không có trong `expected`) vẫn còn trong đầu ra. Bài đạt khi điểm từ 0,5 trở lên.

#### Scenario: Model sửa giống dev
- **WHEN** đầu ra giống hệt `expected`
- **THEN** điểm là 1 và bài đạt

#### Scenario: Model lặp lại lỗi cũ
- **WHEN** đầu ra giống hệt `rejected`
- **THEN** điểm là 0 và bài không đạt

### Requirement: So dòng đã chuẩn hoá
Khi chấm, dòng SHALL được so sau khi bỏ khoảng trắng hai đầu và bỏ dòng trống, đếm theo số lần xuất hiện. Khi dev không thêm dòng nào, độ phủ SHALL là 1; khi dev không xoá dòng nào, độ lặp lỗi SHALL là 0.

#### Scenario: Chỉ khác thụt lề
- **WHEN** đầu ra giống `expected` nhưng thụt lề khác và có thêm dòng trống
- **THEN** điểm là 1

#### Scenario: Dev chỉ xoá dòng
- **WHEN** `expected` là `rejected` bỏ đi một dòng, và đầu ra cũng bỏ dòng đó
- **THEN** độ phủ là 1, độ lặp lỗi là 0, điểm là 1

### Requirement: So sánh và lưu kết quả
Sau khi chạy, lệnh SHALL in cho mỗi model: số bài đã chấm, số bài đạt, điểm trung bình, số lời gọi thất bại; và liệt kê `id` các bài mà kết quả đạt khác nhau giữa các model có câu trả lời được chấm (lời gọi thất bại không tính là không đạt). Kết quả từng bài (id, model, đầu ra, độ phủ, độ lặp lỗi, điểm, lỗi nếu có) SHALL được ghi vào một file JSONL mới trong `.nightowl/runs/`, quyền chỉ chủ sở hữu đọc ghi.

#### Scenario: Một model tốt hơn
- **WHEN** `sonnet` đạt 3/3 bài và `haiku` đạt 1/3
- **THEN** stdout có dòng của mỗi model với số bài đạt, và liệt kê 2 bài chỉ `sonnet` đạt; `.nightowl/runs/` có một file mới với 6 dòng

### Requirement: Không mất kết quả đã trả tiền
Thư mục `.nightowl/runs/` SHALL được chuẩn bị trước lời gọi đầu tiên; nếu không chuẩn bị được, lệnh SHALL báo lỗi và dừng trước khi gửi gì. Nếu ghi file kết quả thất bại sau khi đã chạy, lệnh SHALL vẫn in bảng so sánh và thoát mã 1.

#### Scenario: runs là một file
- **WHEN** `.nightowl/runs` là một file thường và chạy `nightowl eval --yes`
- **THEN** stderr báo không chuẩn bị được thư mục, không có lời gọi `claude` nào, mã thoát 1

### Requirement: Lời gọi model tách biệt và an toàn
Mỗi lời gọi SHALL dùng Claude Code CLI ở chế độ không tương tác, không có tool nào, không lưu phiên, đầu ra JSON theo schema, với `NIGHTOWL_INTERNAL=1`, trong thư mục tạm rỗng, và bị huỷ (cả nhóm tiến trình) sau 180 giây trên cả POSIX và Windows. Đầu ra không hợp lệ, quá 512 KB, đầu ra thô quá 4 MB, hoặc lời gọi lỗi SHALL được ghi là thất bại cho bài đó với model đó, và lệnh SHALL chạy tiếp các bài còn lại rồi thoát mã 1.

#### Scenario: Lời gọi treo
- **WHEN** `claude` không trả lời trong 180 giây cho một bài
- **THEN** tiến trình bị huỷ, bài đó được ghi là thất bại cho model đó, các bài khác vẫn chạy, mã thoát 1

#### Scenario: Huỷ tiến trình trên Windows
- **WHEN** lời gọi model bị huỷ trên Windows
- **THEN** toàn bộ cây tiến trình bị huỷ an toàn theo cơ chế của Windows

### Requirement: Đầu vào không hợp lệ
Khi file bộ test không tồn tại, lệnh SHALL gợi ý chạy `nightowl export` và thoát mã 1. File bộ test không phải file thường hoặc lớn hơn 32 MB SHALL bị từ chối, thoát mã 1. Dòng không phải JSON hoặc không có `schema` bắt đầu bằng `nightowl.eval/v1` SHALL bị bỏ qua và được đếm. Khi `claude` không có trong `PATH` và có `--yes`, lệnh SHALL báo lỗi kèm cách cài và thoát mã 1 mà không tạo file kết quả.

#### Scenario: Chưa export
- **WHEN** chạy `nightowl eval` khi chưa có `.nightowl/export/evals.jsonl`
- **THEN** stderr gợi ý `nightowl export`, mã thoát 1

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

### Requirement: Nhãn thí nghiệm trên run
`nightowl eval` SHALL chấp nhận cờ nhãn đã document (ví dụ `--label <id>`) và gắn nhãn đó vào metadata của file kết quả JSONL trong `.nightowl/runs/` (header/sidecar/field đã document). Nhãn không hợp lệ (rỗng hoặc ký tự cấm đã document) SHALL lỗi trước khi gọi model. Không có `--label` SHALL vẫn chạy như hiện tại (metadata label null/absent).

#### Scenario: Ghi label vào kết quả
- **WHEN** chạy `nightowl eval --yes --label rules-v2` thành công
- **THEN** artifact trong `.nightowl/runs/` mang metadata label `rules-v2` (đọc lại được bởi lệnh compare)

### Requirement: Xuất báo cáo A/B sau khi chạy
Với cờ đã document (ví dụ `--report md|html` và/hoặc `-o` cho báo cáo), sau khi chạy `--yes` và ghi JSONL, `nightowl eval` SHALL sinh thêm báo cáo so sánh A/B cùng semantics capability `eval-ab-compare` (bảng model, case bất đồng; baseline nếu `--baseline` được truyền). Không có cờ report SHALL giữ bảng text stdout hiện có. Dry-run không `--yes` SHALL mô tả report sẽ ghi nếu cờ có mặt, và SHALL NOT gọi model.

#### Scenario: Report HTML sau eval
- **WHEN** chạy `nightowl eval --yes --report html -o .nightowl/eval-report.html` với ≥1 case được chấm
- **THEN** file HTML báo cáo tồn tại; JSONL runs vẫn được ghi; mã thoát theo quy tắc eval hiện có

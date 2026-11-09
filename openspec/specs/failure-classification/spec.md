# failure-classification Specification

## Purpose
Gán cho mỗi bản ghi lỗi một trong bốn loại (sai logic, sai convention, hiểu sai yêu cầu, thiếu ngữ cảnh) bằng LLM, chỉ khi người dùng chủ động yêu cầu và xác nhận việc gửi dữ liệu ra ngoài máy.

## Requirements

### Requirement: Tắt mặc định, chỉ gửi khi xác nhận
NightOwl SHALL NOT gửi bản ghi lỗi tới bất kỳ LLM nào, trừ khi người dùng chạy `nightowl classify --yes`. Không hook và không lệnh nào khác SHALL gọi LLM.

#### Scenario: Chạy thử không có --yes
- **WHEN** có 5 lỗi chưa phân loại và người dùng chạy `nightowl classify`
- **THEN** stdout liệt kê 5 lỗi sẽ được gửi (đường dẫn file), dung lượng ước tính, model, và cách chạy thật với `--yes`; không tiến trình `claude` nào được chạy; database không đổi; mã thoát 0

#### Scenario: Hook không bao giờ phân loại
- **WHEN** chạy `nightowl log`, `nightowl precommit`, `nightowl postcommit`
- **THEN** không tiến trình `claude` nào được chạy

### Requirement: Phân loại và lưu kết quả
Với `--yes`, cho mỗi bản ghi lỗi chưa có loại (tối đa `--limit`, mặc định 20, tối đa 100; bản ghi ít lần phân loại thất bại hơn trước, rồi cũ nhất trước), NightOwl SHALL gửi prompt (nếu có), bản AI viết và bản dev commit cho LLM, và lưu loại lỗi (một trong `logic`, `convention`, `misread-requirement`, `missing-context`), lý do ngắn, độ tin cậy từ 0 tới 1, tên model và thời điểm phân loại.

#### Scenario: Phân loại thành công
- **WHEN** chạy `nightowl classify --yes` với 2 lỗi chưa phân loại và LLM trả về loại hợp lệ
- **THEN** cả 2 bản ghi có `category`, `category_reason`, `category_confidence`, `classifier`, `classified_at`, và stdout tóm tắt số lỗi theo từng loại

#### Scenario: Lỗi đã phân loại
- **WHEN** một bản ghi đã có `category` và chạy `nightowl classify --yes` không có `--redo`
- **THEN** bản ghi đó không được gửi lại

### Requirement: Không tin kết quả LLM mù quáng
Kết quả không phải JSON, thiếu trường, loại không thuộc 4 loại, hoặc độ tin cậy ngoài khoảng 0–1 SHALL bị bỏ: bản ghi giữ nguyên chưa phân loại và được tính là thất bại.

#### Scenario: LLM trả loại lạ
- **WHEN** LLM trả về `{"category":"typo"}`
- **THEN** bản ghi vẫn chưa có loại và stdout báo 1 lỗi phân loại thất bại

### Requirement: Giới hạn dữ liệu gửi đi
Mỗi phần nội dung gửi đi (prompt, bản AI viết, bản dev commit) SHALL được cắt tối đa 20 KB. Phần bị cắt SHALL được đánh dấu trong prompt gửi cho LLM.

#### Scenario: File lớn
- **WHEN** bản AI viết dài 300 KB
- **THEN** chỉ 20 KB đầu được gửi kèm ghi chú đã bị cắt

### Requirement: Lời gọi LLM tách biệt
Mỗi lời gọi SHALL chạy Claude Code CLI ở chế độ không tương tác, không có tool nào (kể cả tool của MCP server và skill trong cấu hình của người dùng), không lưu phiên, đầu ra JSON theo schema, với biến môi trường `NIGHTOWL_INTERNAL=1`, và bị huỷ cả nhóm tiến trình nếu quá 120 giây hoặc khi đầu ra vượt ngưỡng an toàn trên cả POSIX và Windows.

#### Scenario: Lời gọi treo
- **WHEN** `claude` không trả kết quả sau 120 giây
- **THEN** tiến trình bị huỷ, bản ghi giữ nguyên chưa phân loại, các bản ghi còn lại vẫn được xử lý

#### Scenario: Huỷ tiến trình trên Windows
- **WHEN** lời gọi `claude` bị huỷ trên Windows do quá thời gian hoặc vượt dung lượng
- **THEN** toàn bộ cây tiến trình bị huỷ bằng cơ chế phù hợp với Windows mà không ném lỗi tín hiệu POSIX

### Requirement: Báo lỗi rõ ràng
Khi lệnh `claude` không có trong `PATH`, `nightowl classify --yes` SHALL báo lỗi kèm cách cài Claude Code, không thay đổi database, và thoát mã 1. Khi có ít nhất một bản ghi phân loại thất bại, lệnh SHALL thoát mã 1 sau khi lưu các kết quả thành công.

#### Scenario: Chưa cài Claude Code
- **WHEN** chạy `nightowl classify --yes` trên máy không có `claude`
- **THEN** stderr báo không tìm thấy `claude`, database không đổi, mã thoát 1

### Requirement: Gửi kèm prompt phản hồi
Khi một lỗi có prompt phản hồi, `nightowl classify --yes` SHALL gửi kèm nội dung prompt đó trong prompt phân loại, với cùng giới hạn kích thước và cách escape như các phần khác. Không có `--yes` thì vẫn không gửi gì.

#### Scenario: Phân loại lỗi AI tự sửa
- **WHEN** chạy `nightowl classify --yes` với một lỗi `ai-self-fix` có prompt phản hồi
- **THEN** prompt gửi cho `claude` có khối `<feedback>` chứa nội dung prompt phản hồi

### Requirement: Không tự khởi tạo khi phân loại
`nightowl classify` SHALL NOT tạo `.nightowl/`, tạo database, hay nâng schema. Khi chưa chạy `nightowl init` hoặc database cũ, lệnh SHALL báo chạy `nightowl init`, thoát mã 1, và không gọi `claude`.

#### Scenario: Repo chưa cài
- **WHEN** chạy `nightowl classify --yes` trong repo git chưa chạy `nightowl init`
- **THEN** stderr gợi ý `nightowl init`, mã thoát là 1, không tiến trình `claude` nào được chạy, và `.nightowl/` không được tạo

### Requirement: Mỗi lúc một lần phân loại
`nightowl classify --yes` SHALL giữ một khoá trong `.nightowl/` suốt lúc chạy. Khi một tiến trình `classify --yes` khác còn sống đang giữ khoá, lệnh SHALL báo kèm PID và đường dẫn khoá, thoát mã 1, và không gọi `claude`. Khoá của tiến trình đã chết SHALL được bỏ qua và thay thế. Khoá SHALL được giải phóng khi lệnh kết thúc, kể cả khi lỗi. Chạy thử không có `--yes` không cần khoá.

#### Scenario: Hai lần chạy cùng lúc
- **WHEN** một `classify --yes` đang chạy và người dùng chạy thêm `nightowl classify --yes`
- **THEN** lần thứ hai báo đang có lần chạy khác kèm PID, thoát mã 1, và không gọi `claude`

#### Scenario: Khoá bị bỏ lại
- **WHEN** `.nightowl/classify.lock` ghi PID của một tiến trình đã kết thúc, rồi chạy `nightowl classify --yes`
- **THEN** lệnh chạy bình thường, và sau khi xong `.nightowl/classify.lock` không còn

### Requirement: Diff cho thấy thay đổi xuống dòng
Phần diff trong prompt phân loại SHALL hiện mỗi ký tự `\r` thành `␍`, để thay đổi chỉ ở xuống dòng (CRLF và LF) nhìn thấy được. Nội dung các phần khác và database SHALL không đổi.

#### Scenario: AI viết CRLF, dev lưu LF
- **WHEN** bản AI là `a\r\nb\r\n` và bản dev là `a\nb\n`
- **THEN** khối `<diff>` trong prompt có dòng `-a␍` và dòng `+a`

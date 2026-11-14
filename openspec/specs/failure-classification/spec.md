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

### Requirement: Chọn transport CLI hoặc API
`nightowl classify` SHALL chấp nhận `--transport cli|api` (mặc định `cli`). `cli` giữ hành vi gọi `claude` CLI hiện tại. `api` SHALL dùng Anthropic Messages API qua HTTPS. Giá trị khác SHALL bị từ chối, mã thoát 1, không gọi model.

#### Scenario: Mặc định cli
- **WHEN** chạy `nightowl classify --yes` không có `--transport`
- **THEN** NightOwl gọi `claude` CLI như hiện tại

#### Scenario: Transport không hợp lệ
- **WHEN** chạy `nightowl classify --transport foo`
- **THEN** stderr báo lỗi, mã thoát 1, không gọi model

### Requirement: API chỉ chạy khi opt-in và có key
Với `--transport api`, không có `--yes` thì SHALL NOT gửi HTTP. Dry-run SHALL nêu transport `api`, model, và host `api.anthropic.com`. Với `--yes --transport api`, key lấy từ `ANTHROPIC_API_KEY`; thiếu hoặc rỗng SHALL báo lỗi, không đổi DB, mã thoát 1. Key SHALL NOT được in ra stdout/stderr hay ghi vào DB/log NightOwl.

#### Scenario: Dry-run api
- **WHEN** chạy `nightowl classify --transport api` không có `--yes`
- **THEN** stdout nêu sẽ dùng API; không request HTTP nào được gửi; DB không đổi

#### Scenario: Thiếu API key
- **WHEN** chạy `nightowl classify --yes --transport api` mà `ANTHROPIC_API_KEY` trống
- **THEN** stderr báo thiếu key, DB không đổi, mã thoát 1

### Requirement: API dùng cùng hợp đồng phân loại
Khi `--transport api --yes` thành công, NightOwl SHALL gửi cùng nội dung prompt đã cắt giới hạn như CLI, yêu cầu JSON theo schema phân loại hiện có, parse/validate giống CLI (loại lạ → thất bại, không ghi category), và tôn trọng `--limit`, `--redo`, khoá classify, và timeout tương đương (huỷ request quá hạn).

#### Scenario: Phân loại qua API thành công
- **WHEN** chạy `nightowl classify --yes --transport api` với key hợp lệ và API trả category hợp lệ
- **THEN** bản ghi được lưu `category` / reason / confidence / classifier / classified_at như đường CLI

#### Scenario: API trả JSON không hợp lệ
- **WHEN** API trả body không parse được thành classification hợp lệ
- **THEN** bản ghi giữ nguyên chưa phân loại và được đếm thất bại

### Requirement: Phân loại offline không mạng
`nightowl classify --offline` (hoặc cờ tương đương đã document) SHALL phân loại failure chưa có category bằng heuristic local deterministic, không gọi mạng, không yêu cầu `--yes`, không chạy `claude` / Anthropic API. Chỉ gán một trong bốn category hiện có. Khi không khớp rule đủ tin cậy, bản ghi SHALL giữ `category` null (unclassified).

#### Scenario: Offline gán category
- **WHEN** có failure unclassified khớp heuristic convention (hoặc rule đã document) và chạy `nightowl classify --offline`
- **THEN** bản ghi có `category` hợp lệ, `classifier` nhận diện nguồn heuristic, `classified_at` được ghi; không request mạng; mã thoát 0 nếu không lỗi khác

#### Scenario: Offline không khớp thì bỏ qua
- **WHEN** failure unclassified không khớp heuristic nào đủ tin cậy và chạy `classify --offline`
- **THEN** bản ghi vẫn unclassified; lệnh không fail chỉ vì bỏ qua

#### Scenario: Offline không cần --yes
- **WHEN** chạy `classify --offline` không có `--yes`
- **THEN** vẫn ghi category heuristic khi khớp; không mở dry-run LLM thay cho ghi DB

### Requirement: Offline tôn trọng đã phân loại và limit
Offline path SHALL bỏ qua failure đã có category trừ khi `--redo`. SHALL tôn trọng `--limit` (cùng bound đã document với classify LLM). SHALL NOT tạo `.nightowl/` / DB mới (cùng quy tắc “không tự init” như classify hiện có).

#### Scenario: Bỏ qua đã có category
- **WHEN** failure đã có category heuristic hoặc LLM và chạy `classify --offline` không `--redo`
- **THEN** category/classifier không đổi

#### Scenario: Redo offline ghi đè
- **WHEN** failure đã có category và chạy `classify --offline --redo` với heuristic khớp category khác
- **THEN** category/classifier/reason/confidence được cập nhật từ heuristic

### Requirement: LLM vẫn opt-in và có thể ghi đè heuristic
Đường LLM (`classify --yes`, transport cli|api) SHALL giữ nguyên: không gửi dữ liệu ra ngoài khi thiếu `--yes`. Khi `--yes` (và `--redo` nếu bản ghi đã có category), LLM MAY ghi đè kết quả heuristic. Không `--redo` → bỏ qua bản ghi đã có category (kể cả heuristic), như hành vi hiện tại.

#### Scenario: LLM dry-run không đổi DB
- **WHEN** chạy `classify` không `--yes` và không `--offline`
- **THEN** hành vi dry-run LLM hiện tại giữ nguyên; DB không đổi vì LLM; không bắt buộc chạy heuristic

#### Scenario: LLM redo ghi đè heuristic
- **WHEN** failure đã classifier heuristic và chạy `classify --yes --redo` với LLM trả category hợp lệ
- **THEN** bản ghi cập nhật category và `classifier` nguồn LLM

### Requirement: Classifier nguồn heuristic ổn định
Khi ghi kết quả offline, NightOwl SHALL đặt `classifier` thành giá trị ổn định đã document nhận diện heuristic (ví dụ `heuristic` hoặc `heuristic:<rule-id>`), `category_reason` ngắn giải thích rule khớp, và `category_confidence` trong [0, 1] theo rule. SHALL NOT lưu tên developer.

#### Scenario: Classifier heuristic
- **WHEN** offline classify thành công một failure
- **THEN** `classifier` bắt đầu bằng `heuristic` (hoặc đúng token đã document); reason không rỗng

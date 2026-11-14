# weekly-digest Specification

## Purpose

Sinh digest định kỳ (Markdown hoặc HTML) từ store NightOwl local cho cửa sổ thời gian đã chọn, phục vụ standup/weekly trên máy, không gửi email/Slack và không lộ danh tính developer.

## Requirements

### Requirement: Lệnh digest
`nightowl digest` (hoặc tên đã document) SHALL đọc store dự án chỉ-đọc, tóm tắt dữ liệu trong cửa sổ thời gian (mặc định 7 ngày UTC hoặc `--since` đã document), rồi xuất Markdown ra stdout mặc định và thoát 0 khi thành công. Lệnh SHALL NOT tạo DB nếu chưa init (stderr hướng dẫn, thoát ≠ 0). SHALL NOT gọi mạng, LLM, hay tự gửi email/Slack/webhook.

#### Scenario: Digest Markdown mặc định
- **WHEN** store đã init có ≥1 failure không dismissed trong cửa sổ mặc định và chạy `nightowl digest`
- **THEN** stdout là Markdown gồm ít nhất tổng failure mới và một mục top category hoặc agent; thoát 0

#### Scenario: Chưa init
- **WHEN** chạy digest trong repo chưa có `.nightowl/nightowl.db`
- **THEN** không tạo DB; stderr hướng dẫn init; thoát ≠ 0

### Requirement: Cửa sổ thời gian
Digest SHALL chấp nhận bộ lọc thời gian đã document (ví dụ `--since YYYY-MM-DD` và/hoặc relative `Nd` như `7d`). Khi bỏ qua, cửa sổ mặc định SHALL là 7 ngày gần nhất (UTC). Cửa sổ không hợp lệ SHALL thoát ≠ 0 với stderr rõ.

#### Scenario: --since YYYY-MM-DD
- **WHEN** chạy `nightowl digest --since 2026-11-01`
- **THEN** chỉ tính bản ghi từ ngày đó trở đi (UTC); thoát 0 nếu store hợp lệ

#### Scenario: since không hợp lệ
- **WHEN** chạy `nightowl digest --since nope`
- **THEN** stderr báo lỗi; thoát ≠ 0

### Requirement: Nội dung tóm tắt
Digest SHALL gồm: số failure mới (không tính `dismissed`), top category và/hoặc agent trong cửa sổ, số failure còn `flagged` (gợi ý review), và khi có bản rule-applied local thì một dòng/tối thiểu tóm tắt impact trước/sau (không bắt buộc người dùng chạy mark trước — nếu không có bản ghi thì nêu rõ chưa có). MAY gồm Signals (ci-fail / pr-review / revert) nếu đếm được. SHALL NOT lộ tên/email/username developer.

#### Scenario: Có flagged để review
- **WHEN** store có ≥1 failure `flagged` và chạy digest
- **THEN** output nêu số (hoặc mục) review còn mở > 0

#### Scenario: Không có rule-applied
- **WHEN** store không có bản rule-applied và chạy digest
- **THEN** phần rule-impact nói rõ chưa có / n/a; lệnh vẫn thoát 0

### Requirement: Xuất HTML local
Digest SHALL hỗ trợ xuất HTML self-contained local (flag `--format html` hoặc tương đương) vào đường dẫn `--output`/`-o` đã document (mặc định dưới `.nightowl/` khi ghi file). HTML SHALL NOT tải CDN/script ngoài; SHALL NOT gọi mạng.

#### Scenario: Ghi HTML
- **WHEN** chạy `nightowl digest --format html -o .nightowl/digest.html` với store hợp lệ
- **THEN** file tồn tại, bắt đầu bằng doctype/html hợp lệ, không chứa `https://` CDN; thoát 0

### Requirement: Chỉ đọc store
Digest SHALL mở store chỉ đọc; không migrate schema, không ghi events/failures. Chạy hai lần liên tiếp với cùng dữ liệu SHALL không đổi DB.

#### Scenario: Không ghi DB
- **WHEN** chạy digest rồi so sánh file DB trước/sau
- **THEN** nội dung DB không đổi

### Requirement: Digest tôn trọng coarsen path
Khi bật cờ làm thô path đã document và digest có in path/module, output SHALL coarsen theo profile privacy. Nếu digest MVP không in path file, cờ MAY no-op nhưng SHALL vẫn được chấp nhận (không lỗi) khi có trên CLI chung hoặc bị bỏ qua đã document. Secret/email trong text SHALL được redacted nếu xuất hiện.

#### Scenario: Cờ coarsen được chấp nhận
- **WHEN** chạy `nightowl digest` với cờ coarsen path đã document
- **THEN** thoát 0 (hoặc lỗi cấu hình rõ nếu cờ không hỗ trợ — ưu tiên chấp nhận no-op); không crash

### Requirement: Digest chấp nhận --workspace
`nightowl digest` SHALL chấp nhận `--workspace` với semantics lọc path/workspace giống report khi digest đếm failure theo cửa sổ. Nếu một phần digest không gắn module, filter vẫn SHALL loại failure ngoài workspace trước khi aggregate. Cờ không hợp lệ SHALL lỗi rõ.

#### Scenario: Digest lọc workspace
- **WHEN** chạy `nightowl digest --workspace <name>` với store monorepo có failure đa package
- **THEN** tổng failure trong digest chỉ gồm workspace khớp; mã thoát 0

### Requirement: Digest rule-impact khớp dashboard
Dòng/tóm tắt rule-impact trong `nightowl digest` (Markdown và HTML) SHALL dùng cùng semantics và wording ổn định đã document với dashboard: có mark → label + before → after + delta; không mark → none recorded (hoặc tương đương); lỗi đọc → n/a. Thay đổi wording SHALL không đổi nghĩa đếm impact. SHALL NOT lộ tên/email developer.

#### Scenario: Digest và dashboard cùng none
- **WHEN** store không có rule-applied rồi chạy `digest` và `dashboard`
- **THEN** cả hai nêu none/n/a cho rule-impact; thoát 0

#### Scenario: Digest có mark
- **WHEN** store có rule-applied với label đã biết rồi chạy `nightowl digest`
- **THEN** output chứa label đó trong phần rule-impact

### Requirement: Digest nêu metric repeat
`nightowl digest` SHALL gồm một dòng hoặc khối ngắn về metric repeat (repeat vs new và/hoặc rate) trong cửa sổ digest, theo cùng định nghĩa `repeat-outcomes` (baseline mặc định hoặc flag đã document nếu digest hỗ trợ). SHALL NOT lộ tên developer; SHALL NOT gọi mạng.

#### Scenario: Digest Markdown có repeat
- **WHEN** chạy `nightowl digest` trên store có failure trong cửa sổ và baseline
- **THEN** Markdown stdout đề cập repeat/new hoặc repeat rate

#### Scenario: Digest HTML có repeat khi format html
- **WHEN** chạy `nightowl digest --format html -o <file>` với dữ liệu tương tự
- **THEN** HTML chứa tóm tắt repeat tương đương (không CDN)

### Requirement: digest đọc defaults từ local config
Khi không truyền flag tương ứng, `nightowl digest` SHALL áp dụng defaults từ local-config đã merge cho cửa sổ (`since` / lookback đã document), `agents`, và `workspaces` nếu có. Flag CLI thắng. Config invalid SHALL thoát ≠ 0 với stderr rõ.

#### Scenario: Lookback từ config
- **WHEN** config đặt digest lookback/window đã document và chạy `digest` không `--since`
- **THEN** digest dùng cửa sổ từ config thay vì chỉ built-in mặc định

#### Scenario: Không có config giữ mặc định cũ
- **WHEN** không có file config và chạy `digest` không `--since`
- **THEN** hành vi cửa sổ mặc định hiện tại vẫn giữ

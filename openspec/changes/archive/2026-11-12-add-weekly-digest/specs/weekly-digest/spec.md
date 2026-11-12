# Spec Delta

## Purpose

Sinh digest định kỳ (Markdown hoặc HTML) từ store NightOwl local cho cửa sổ thời gian đã chọn, phục vụ standup/weekly trên máy, không gửi email/Slack và không lộ danh tính developer.

## ADDED Requirements

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

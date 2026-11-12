# agent-ingest Specification

## Purpose

Chuẩn hoá prompt và lần sửa file từ nhiều trợ lý AI thành sự kiện NightOwl local, không làm chậm hay chặn agent, để so sánh được với bản commit.

## Requirements

### Requirement: Agent id chuẩn
Mỗi sự kiện prompt/edit từ trợ lý AI SHALL mang `agent` thuộc tập cố định: `claude-code`, `cursor`, `windsurf`, `cline`, `roo`, `copilot-workspace`, `aider`. Giá trị khác SHALL bị từ chối hoặc bỏ qua an toàn (exit 0, không ghi).

#### Scenario: Cursor edit
- **WHEN** `nightowl log` nhận payload Cursor `afterFileEdit` hợp lệ
- **THEN** sự kiện `edit` được ghi với `agent` là `cursor`

#### Scenario: Agent không hỗ trợ
- **WHEN** payload khai báo agent `unknown-bot`
- **THEN** không ghi DB; lệnh thoát 0

### Requirement: nightowl log nhận nhiều định dạng hook
`nightowl log` SHALL nhận JSON stdin từ hook Claude Code (như hiện tại) **và** từ adapter các agent khác, rồi quy về cùng mô hình sự kiện `prompt` / `edit` (session id, đường dẫn tương đối, nội dung file hoặc diff đủ để snapshot).

#### Scenario: Cursor afterFileEdit
- **WHEN** stdin là JSON Cursor `afterFileEdit` với `file_path` trong repo
- **THEN** NightOwl đọc file trên đĩa (hoặc áp edits) và lưu snapshot edit như với Claude Code

#### Scenario: Cursor beforeSubmitPrompt
- **WHEN** stdin là JSON Cursor có prompt người dùng
- **THEN** lưu sự kiện `prompt` với session/conversation id Cursor

### Requirement: Fail-open và giới hạn thời gian
Mọi đường ingest agent SHALL thoát mã 0 với Claude/Cursor/…, không in stderr làm dừng agent, và bỏ cuộc trong giới hạn thời gian hiện có của hook (không chậm vòng agent).

#### Scenario: File không đọc được
- **WHEN** hook edit trỏ file không đọc được
- **THEN** không ném lỗi ra agent; có thể ghi error log nội bộ; exit 0

### Requirement: Hỗ trợ đủ danh sách agent roadmap
NightOwl SHALL cung cấp, cho mỗi agent trong registry (`cursor`, `windsurf`, `cline`, `roo`, `copilot-workspace`, `aider` ngoài Claude Code): (1) đường ingest/`nightowl log` khớp maturity của agent, (2) hướng dẫn cấu hình (qua `init` và/hoặc README) đúng với cách tool hoặc wrapper thực sự nhận lệnh, và (3) không tuyên bố hook native nếu maturity là `manual`.

#### Scenario: init cài Cursor
- **WHEN** chạy `nightowl init` trên máy có quyền ghi `.cursor/`
- **THEN** cấu hình hook Cursor của NightOwl được thêm (idempotent) mà không xoá hook khác

#### Scenario: init agent manual
- **WHEN** chạy `nightowl init --agents <manual-agent>` với agent maturity `manual`
- **THEN** lệnh không giả tạo hook native;stdout/stderr có hướng dẫn wrap đã document; exit 0

### Requirement: Mức hỗ trợ (maturity) theo agent
NightOwl SHALL gán mỗi agent id một mức hỗ trợ công khai: `verified` (hook/cấu hình tool đọc được + adapter có fixture), `best-effort` (parse được payload đã document nhưng cấu hình tool có thể cần bước thủ công), hoặc `manual` (chỉ document cách bọc gọi `nightowl log`). Claude Code và Cursor SHALL là `verified`.

#### Scenario: Tra cứu maturity
- **WHEN** người dùng xem README hoặc output `doctor` liên quan agent
- **THEN** mỗi agent trong registry có một mức `verified` | `best-effort` | `manual` nhất quán với implementation

### Requirement: Adapter có fixture cho agent ngoài Claude/Cursor
Với mỗi agent id khác `claude-code` và `cursor`, NightOwl SHALL có đường parse chuyên biệt hoặc contract có kiểm thử: ít nhất một fixture JSON đại diện sự kiện `prompt` và/hoặc `edit` (theo khả năng tool) dẫn tới sự kiện lưu đúng `agent` đó. SHALL NOT coi việc chỉ ghi file marker NightOwl là đủ để tuyên bố ingest native.

#### Scenario: Fixture Windsurf edit
- **WHEN** `nightowl log` nhận fixture Windsurf edit đã document
- **THEN** DB có sự kiện `edit` với `agent` là `windsurf` (hoặc thoát 0 không ghi nếu maturity là `manual` và fixture chỉ minh họa wrap — khi đó test document rõ không assert ghi DB từ hook native giả)

#### Scenario: Payload không khớp agent bị ép
- **WHEN** `--agent windsurf` nhưng stdin không phải JSON hợp lệ cho contract Windsurf
- **THEN** không ghi sự kiện giả; exit 0; có thể ghi error log nội bộ

### Requirement: Adapter chuyên biệt cho agent best-effort
Với mỗi agent maturity `best-effort` trong registry (`windsurf`, `cline`, `roo`), NightOwl SHALL cung cấp đường parse chuyên biệt (module/parser riêng hoặc contract riêng có kiểm thử) nhận diện payload theo event/field đã document cho agent đó, không chỉ dựa generic hint yếu dùng chung mọi agent. Claude Code và Cursor SHALL giữ parser riêng hiện có. Đường parse SHALL fail-open (exit 0, không ném ra agent) khi payload không khớp.

#### Scenario: Windsurf edit qua adapter riêng
- **WHEN** `nightowl log` nhận fixture Windsurf edit đã document (không ép `--agent` nếu auto-detect hỗ trợ)
- **THEN** DB ghi `edit` với `agent` là `windsurf`

#### Scenario: Cline prompt qua adapter riêng
- **WHEN** stdin là fixture Cline prompt đã document với `--agent cline` hoặc field agent tường minh
- **THEN** DB ghi `prompt` với `agent` là `cline`

#### Scenario: Payload best-effort không khớp contract
- **WHEN** `--agent windsurf` nhưng stdin JSON không khớp contract Windsurf đã document
- **THEN** không ghi sự kiện giả; exit 0

### Requirement: Fixture gần payload tool hơn cho best-effort
Mỗi agent `best-effort` SHALL có fixture kiểm thử (≥1 prompt và ≥1 edit, trừ khi README document agent chỉ hỗ trợ một loại) phản ánh field/event name đã document gần với tool hơn so với chỉ `{ hook_event_name, file_path }` tối thiểu nếu contract agent đó có thêm field (vd. session id, cwd). Fixture SHALL được dùng trong test adapter; SHALL NOT dùng marker-only làm bằng chứng ingest.

#### Scenario: Bộ fixture windsurf/cline/roo
- **WHEN** chạy suite adapter cho `windsurf`, `cline`, `roo`
- **THEN** mỗi agent có case prompt và edit pass với `agent` đúng id

### Requirement: Document giới hạn ingest theo agent
Tài liệu người dùng (README mục agent và/hoặc help liên quan) SHALL nêu ngắn giới hạn từng agent trong registry: maturity, loại sự kiện hỗ trợ (prompt/edit), và rủi ro còn lại (vd. IDE cần bật hook, wrap thủ công). SHALL NOT tuyên bố ingest native đầy đủ cho agent `manual`.

#### Scenario: README liệt kê giới hạn best-effort/manual
- **WHEN** đọc README bảng agent sau change
- **THEN** mỗi agent best-effort/manual có ghi chú giới hạn hoặc bước thủ công còn lại

# Spec Delta

## ADDED Requirements

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

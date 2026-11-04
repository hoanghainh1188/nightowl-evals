# Design

## Context

Xem proposal.md. Hành vi: `specs/failure-classification`, `specs/claude-code-hook`. Dựa trên bảng `failures` (schema v2 của change 5: có `prompt_event_id`). Người dùng đã chọn gọi LLM qua Claude Code CLI (`claude -p`), thay vì Ollama hay gọi Anthropic API trực tiếp.

Các cờ của `claude` (bản 2.1.x) được dùng: `-p/--print`, `--output-format json`, `--json-schema`, `--tools`, `--no-session-persistence`, `--model`.

## Goals / Non-Goals

**Goals:**
- Người dùng luôn thấy trước sẽ gửi gì, và phải gõ `--yes` mới gửi.
- Lời gọi không có tool, không tạo phiên, không bị hook của NightOwl ghi lại.
- Kết quả LLM được kiểm tra trước khi ghi vào DB.

**Non-Goals:**
- Gọi song song nhiều lời gọi (tuần tự là đủ cho 50 lỗi).
- Tối ưu chi phí theo token, cache kết quả giữa các máy.

## Decisions

### 1. Gọi `claude -p` qua `spawn`, prompt qua stdin
```
claude -p --output-format json --json-schema <schema> --tools "" \
       --strict-mcp-config --mcp-config '{"mcpServers":{}}' --disable-slash-commands \
       --permission-mode dontAsk --no-session-persistence --model <model>
```
- `--tools ""` chỉ tắt tool có sẵn. MCP server và skill ở cấp user vẫn được nạp, nên thêm `--strict-mcp-config` với danh sách MCP rỗng, `--disable-slash-commands` và `--permission-mode dontAsk`. Nhờ vậy LLM không có tool nào để gọi, dù settings của người dùng cho phép gì. Không dùng `--bare` vì nó đổi cách xác thực (chỉ nhận `ANTHROPIC_API_KEY`).
- Prompt đi qua stdin, không qua tham số dòng lệnh (`ps` sẽ thấy tham số, và có giới hạn độ dài).
- `cwd` là một thư mục tạm rỗng, xoá sau khi dùng, nên Claude Code không nạp `CLAUDE.md` hay `.claude/settings.json` của dự án.
- `env`: `process.env` cộng `NIGHTOWL_INTERNAL=1`. Hook của người dùng (ở cấp user) vẫn có thể chạy `nightowl log`, nên `log` kiểm tra biến này rồi bỏ qua.
- Huỷ sau 120 giây: `claude` chạy trong nhóm tiến trình riêng, khi quá giờ thì kill cả nhóm (cả tiến trình con nó tạo ra).

*Phương án khác:* Anthropic SDK: cần API key riêng và thêm dependency; người dùng đã chọn CLI.

### 2. Đọc kết quả
Với `--output-format json`, stdout là một object JSON. Lấy `structured_output` nếu có, nếu không thì parse chuỗi `result` thành JSON. Bước này viết phòng thủ, vì định dạng đầu ra của CLI có thể đổi giữa các bản. Task 5.3 kiểm tra trên bản `claude` thật trước khi đánh dấu xong.
Schema:
```json
{ "type": "object",
  "required": ["category", "reason", "confidence"],
  "properties": {
    "category": { "enum": ["logic", "convention", "misread-requirement", "missing-context"] },
    "reason": { "type": "string", "maxLength": 300 },
    "confidence": { "type": "number", "minimum": 0, "maximum": 1 } } }
```
Dù đã có schema, kết quả vẫn được kiểm tra lại trong code (spec "Không tin kết quả LLM mù quáng").

### 3. Prompt gửi đi
Gồm định nghĩa ngắn của 4 loại, đường dẫn file, prompt của người dùng (nếu có), diff dạng unified giữa bản AI và bản dev, rồi hai bản đầy đủ. Mỗi phần cắt tối đa 20 KB theo byte UTF-8, có ghi chú khi bị cắt. Thẻ đóng (ví dụ `</developer_version>`) nằm trong nội dung repo được vô hiệu hoá, để code không giả làm chỉ dẫn của NightOwl. Diff được tính bằng thuật toán Myers viết trong `src/classify/diff.ts` (không thêm dependency). Diff tính bằng thuật toán chạy trong bộ nhớ, không cần file tạm, nên không có file nào phải ghi ra ngoài `.nightowl/`.

### 4. Schema v3
```sql
ALTER TABLE failures ADD COLUMN category_reason     TEXT;
ALTER TABLE failures ADD COLUMN category_confidence REAL CHECK (category_confidence BETWEEN 0 AND 1);
ALTER TABLE failures ADD COLUMN classified_at       TEXT;
ALTER TABLE failures ADD COLUMN classifier          TEXT;   -- ví dụ "claude-code:haiku"
ALTER TABLE failures ADD COLUMN classify_attempts   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE failures ADD COLUMN classify_error      TEXT;
```
Lỗi phân loại thất bại được ghi lại (`classify_attempts`, `classify_error`). Thứ tự chọn là ít lần thất bại nhất trước, rồi cũ nhất trước, để vài bản ghi luôn lỗi không chặn các bản ghi mới. `--limit` tối đa 100.

### 5. Chạy thử là mặc định
Không có `--yes`: in danh sách lỗi sẽ gửi (đường dẫn file, dung lượng sau khi cắt), model và dòng lệnh để chạy thật. Đây là cách "người dùng tự bật" theo nguyên tắc 2 của dự án: không có file config nào để bật ngầm.

### 6. Phân tách để test
`createClassifyCommand({ runClaude, cwd })`. Test dùng `runClaude` giả. Một test e2e dùng file `claude` giả đặt trong `PATH` để kiểm tra đúng cờ, đúng biến môi trường và prompt đi qua stdin.

## Risks / Trade-offs

- [Code rời khỏi máy] → Chỉ khi chạy `--yes`; bản chạy thử cho thấy chính xác sẽ gửi gì; giới hạn 20 KB mỗi phần; README sẽ nói rõ.
- [Định dạng đầu ra hoặc cờ của `claude` thay đổi] → Đọc kết quả phòng thủ; lỗi chỉ làm bản ghi đó chưa được phân loại.
- [Tốn chi phí] → `--limit` mặc định 20, model mặc định `haiku`; mỗi lỗi chỉ phân loại một lần trừ khi dùng `--redo`.
- [Hook cấp user của người dùng vẫn chạy khi gọi `claude`] → `NIGHTOWL_INTERNAL=1` khiến `nightowl log` bỏ qua; hook của công cụ khác không nằm trong phạm vi.

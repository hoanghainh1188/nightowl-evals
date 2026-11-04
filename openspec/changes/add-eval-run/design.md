# Design

## Context

Xem proposal.md. Hành vi: `specs/eval-run`. Dựa trên:
- định dạng `nightowl.eval/v1` (change 8): `input.prompt`, `input.file_before`, `rejected`, `expected`, `criteria.type = "reference"`;
- `runClaude` và các cờ cô lập đã kiểm chứng với `claude` 2.1.311 thật (change 6, task 5.3);
- `printable`, `writeFileAtomic(path, content, 0o600)`, kiểm tra tuỳ chọn kiểu `classify`.

## Goals / Non-Goals

**Goals:**
- So được 2 model trên chính lỗi của dự án, ra con số dễ hiểu.
- Chấm điểm tất định, rẻ, chạy lại được: không dùng LLM làm giám khảo.

**Non-Goals:**
- Chấm "đúng tuyệt đối" (cần chạy test của dự án; để sau).
- So prompt hoặc luật CLAUDE.md; model ngoài Claude.

## Decisions

### 1. Gọi model qua `claude -p`, dùng lại `runClaude`
`runClaude` được tổng quát: nhận `schema` (JSON Schema của đầu ra) và `timeoutMs`; `classify` truyền schema phân loại như cũ. Schema của `eval`:
```json
{ "type": "object", "required": ["content"], "additionalProperties": false,
  "properties": { "content": { "type": "string" } } }
```
Đọc đầu ra bằng cùng cách phòng thủ như change 6 (`structured_output`, rồi `result` dạng JSON), giới hạn 512 KB. Huỷ sau 180 giây, vì sinh cả file lâu hơn phân loại.

*Phương án khác:* gọi thẳng Anthropic API → cần API key và dependency, trái lựa chọn ở change 6.

### 2. Prompt gửi model
Gồm: đường dẫn file, yêu cầu của dev (`input.prompt`), nội dung file trước commit (hoặc ghi chú "file chưa có"), và yêu cầu trả về **toàn bộ** nội dung file sau khi làm theo yêu cầu. Nội dung repo nằm trong thẻ, thẻ đóng trong nội dung được vô hiệu hoá (cách của change 6), kèm câu nói rõ nội dung trong thẻ là dữ liệu.
Model chỉ thấy đúng một file, nên điểm thấp có thể do thiếu ngữ cảnh (đúng loại lỗi `missing-context`). Điều này như nhau cho mọi model nên vẫn so được.
Bài bị bỏ qua: không có prompt (không có yêu cầu để làm lại), hoặc `file_before` > 64 KB (tốn quota, đầu ra dễ bị cắt).

### 3. Chấm điểm theo dòng thay đổi
```
added   = multiset(expected) − multiset(rejected)   // dòng dev thêm
removed = multiset(rejected) − multiset(expected)   // dòng dev xoá
coverage = |added ∩ output| / |added|      (added rỗng → 1)
repeat   = |removed ∩ output| / |removed|  (removed rỗng → 0)
score    = coverage × (1 − repeat);  pass ⇔ score ≥ 0.5
```
Dòng được chuẩn hoá: bỏ khoảng trắng hai đầu, bỏ dòng trống. Phép giao trên multiset đếm số lần xuất hiện.
Lý do: bản ghi lỗi chỉ cho biết dev đã đổi gì, nên tiêu chí "đạt" hợp lý nhất là model tự làm ra đúng những thay đổi đó và không lặp lại dòng dev đã bỏ. Cách này rẻ, tất định, giải thích được.
Hạn chế: một cách sửa khác nhưng cũng đúng sẽ bị điểm thấp. Chấp nhận ở MVP, vì so *giữa* các model trên cùng thước đo vẫn có ý nghĩa.

### 4. Lưu kết quả
Mỗi lần chạy `--yes` ghi `.nightowl/runs/<thời điểm UTC>.jsonl` (thư mục `0700`, file `0600`, ghi nguyên tử), mỗi dòng:
```json
{ "run_at": "...", "case_id": "...", "model": "haiku", "output": "...", "coverage": 0.8,
  "repeat": 0, "score": 0.8, "pass": true, "error": null }
```
Không ghi vào database, để không đổi schema; change sau có thể đọc các file này.

### 5. Bảng so sánh
```
Ran 20 cases × 2 models (3 skipped: 2 without prompt, 1 too large)
  model    scored  passed  mean score  failed calls
  haiku        20       9        0.48             0
  sonnet       20      14        0.71             0
Different results (6): sonnet only: 3f2a9c1d8e07-12, …; haiku only: …
Results saved to .nightowl/runs/2026-11-10T09-30-00Z.jsonl
```

### 6. Thứ tự và giới hạn
Chạy tuần tự: bài theo thứ tự trong file, trong mỗi bài lần lượt từng model, để một bài lỗi không làm lệch so sánh. `--limit` tính theo số bài (không theo số lời gọi), tối đa 100. Kiểm tra `claude` có trong `PATH` trước khi đọc hay tạo gì.

## Risks / Trade-offs

- [Code rời khỏi máy, nhiều hơn `classify`] → Chỉ với `--yes`; chạy thử cho thấy số bài, số lời gọi, dung lượng; bỏ bài lớn hơn 64 KB.
- [Tốn quota: bài × model lời gọi] → `--limit` mặc định 20; mặc định 2 model.
- [Điểm theo dòng phạt cách sửa khác mà đúng] → Ghi rõ trong output và README; chấm bằng test của dự án để sau.
- [Model trả về file bị cắt hoặc kèm giải thích] → Schema JSON với một trường `content`; đầu ra không hợp lệ tính là thất bại, không phải điểm 0.

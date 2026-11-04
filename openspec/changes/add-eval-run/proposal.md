# Proposal

## Why

Change 8 đã biến mỗi lỗi thành một bài test (`nightowl.eval/v1`). Bước cuối của MVP (tuần 4) là "chạy lại bộ test với 2 model, so điểm". Đây là chỗ NightOwl trả lời câu hỏi trong doc: đổi model thì tốt hơn hay tệ hơn, và AI giúp được bao nhiêu. Kết quả cũng là số liệu để tổng kết tuần 4 ("đáng làm tiếp không?").

## What Changes

- Lệnh mới `nightowl eval`:
  - đọc bộ test JSONL (mặc định `.nightowl/export/evals.jsonl`, hoặc `--input <file>`);
  - với mỗi bài test và mỗi model, gửi prompt gốc của dev và file trước commit cho model, yêu cầu trả về toàn bộ nội dung file sau khi sửa;
  - chấm điểm tự động, không dùng LLM để chấm: so đầu ra của model với bản dev commit (`expected`) và bản AI từng viết sai (`rejected`);
  - in bảng so sánh giữa các model: số bài, số bài đạt, điểm trung bình, và các bài mà model này đạt còn model kia không.
- Tuỳ chọn: `--model <tên>` lặp lại được (mặc định `haiku` và `sonnet`), `--limit <n>` (mặc định 20 bài, tối đa 100), `--yes`.
- **Mặc định chỉ chạy thử**, giống `classify`: in số bài, số lời gọi (bài × model), dung lượng sẽ gửi, rồi dừng. Chỉ khi có `--yes` mới gửi dữ liệu ra ngoài máy.
- Lời gọi model dùng lại cách gọi `claude -p` đã kiểm chứng ở change 6: không tool, không MCP, không skill, không lưu phiên, JSON theo schema, `NIGHTOWL_INTERNAL=1`, thư mục tạm rỗng, huỷ cả nhóm tiến trình khi quá giờ.
- Kết quả từng lần chạy được lưu thành file JSONL trong `.nightowl/runs/` (đầu ra của model, điểm từng bài), quyền `0600`, để xem lại và so giữa các lần chạy.
- Bài test không có prompt, hoặc có file trước commit lớn hơn 64 KB, được bỏ qua và đếm riêng.

Ngoài phạm vi: model không phải của Claude (OpenAI, model local), so sánh prompt hoặc luật CLAUDE.md (để sau MVP), dùng LLM làm giám khảo, chạy test hay build của dự án để chấm, chạy song song.

## Capabilities

### New Capabilities

- `eval-run`: Chạy lại bộ test với nhiều model qua Claude Code CLI, chấm điểm tự động và so sánh, chỉ khi người dùng xác nhận gửi dữ liệu.

### Modified Capabilities

(không có)

## Impact

- Code: `src/commands/eval.ts`, thư mục mới `src/eval/` (đọc bộ test, dựng prompt, chấm điểm, lưu kết quả), `src/classify/run-claude.ts` (tổng quát hoá: nhận schema và thời gian huỷ).
- Không đổi schema database. Không thêm dependency.
- Lần thứ hai dữ liệu rời khỏi máy (sau `classify`), và cũng chỉ khi có `--yes`. Tốn quota theo tài khoản Claude Code: 20 bài × 2 model = 40 lời gọi mỗi lần chạy mặc định.

# Proposal

## Why

Bản ghi lỗi (change 5) mới cho biết *chỗ nào* AI bị sửa, chưa cho biết *vì sao*. Doc chốt 4 loại lỗi: sai logic, sai convention, hiểu sai yêu cầu, thiếu ngữ cảnh. Có loại lỗi thì báo cáo (change 7) mới chia được theo loại, và mới gợi ý được luật mới cho CLAUDE.md. Phân loại tay 50+ lỗi thì tốn công, nên dùng LLM, nhưng **tắt mặc định** vì đây là nơi duy nhất code rời khỏi máy.

## What Changes

- Lệnh mới `nightowl classify`:
  - không có `--yes`: chỉ in sẽ gửi gì (số lỗi, danh sách file, dung lượng ước tính, model), **không gửi gì**, thoát 0;
  - có `--yes`: với từng bản ghi lỗi chưa phân loại, gọi Claude Code CLI ở chế độ không tương tác (`claude -p`) và lưu loại lỗi, lý do ngắn, độ tin cậy, model, thời điểm phân loại;
  - tuỳ chọn: `--limit <n>` (mặc định 20), `--model <tên>` (mặc định `haiku`), `--redo` (phân loại lại cả lỗi đã có loại).
- Lời gọi `claude -p` chạy với: không có tool, không lưu phiên, đầu ra JSON theo schema cố định, biến môi trường `NIGHTOWL_INTERNAL=1`.
- `nightowl log` bỏ qua mọi sự kiện khi `NIGHTOWL_INTERNAL=1`, để lời gọi phân loại không bị chính hook của NightOwl ghi lại thành prompt/edit.
- Không có gì tự gọi LLM: không hook nào, không lệnh nào khác.
- Migration schema v3: thêm cột `category_reason`, `category_confidence`, `classified_at`, `classifier` vào `failures`.

Ngoài phạm vi: Ollama hoặc model local, gọi Anthropic API trực tiếp, tự phân loại sau mỗi commit, phân loại bằng tay qua CLI, gợi ý luật CLAUDE.md (để sau change 7).

## Capabilities

### New Capabilities

- `failure-classification`: Phân loại bản ghi lỗi vào 4 loại bằng LLM, chỉ khi người dùng chủ động chạy và xác nhận gửi dữ liệu.

### Modified Capabilities

- `claude-code-hook`: `nightowl log` bỏ qua sự kiện do chính NightOwl tạo ra.

## Impact

- Code: `src/commands/classify.ts`, thư mục mới `src/classify/` (dựng prompt, gọi `claude`, đọc kết quả), `src/storage/` (migration v3), `src/hooks/claude-code/record.ts`.
- Lần đầu dữ liệu rời khỏi máy, và chỉ qua `nightowl classify --yes`. Dữ liệu đi tới Anthropic qua Claude Code của người dùng, đúng nơi Claude Code vốn đã gửi code tới. Tốn quota hoặc chi phí theo tài khoản Claude Code của người dùng.
- Cần Claude Code CLI (`claude`) trong `PATH` khi chạy `classify --yes`. Không thêm dependency npm.
- Phải archive sau `add-failure-records` (dùng schema v2).

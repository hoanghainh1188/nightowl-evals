# Proposal

## Why

NightOwl đã ghi lỗi tự động trên dự án thật (`aegis-code`). Bước tiếp theo theo doc là xem lại: lỗi nào là thật, lỗi nào là nhiễu ("bỏ các lần dev chỉ đổi ý"). Bảng `failures` đã có cột `status` (`flagged`, `confirmed`, `dismissed`) từ schema v1, và `report`, `export` đã bỏ lỗi `dismissed`. Nhưng chưa có lệnh nào để **xem từng lỗi** hay **đổi trạng thái**: muốn vậy phải tự mở database bằng `sqlite3`.

Không có bước này thì:
- Nhiễu (đổi ý, sửa không liên quan) lọt vào báo cáo và bộ test.
- Không đo được thuật toán phát hiện đúng bao nhiêu, nên không có số liệu cho bước tổng kết tuần 4.

## What Changes

Lệnh mới `nightowl review`, gồm các lệnh con:

- `nightowl review` (hay `review list`): liệt kê lỗi, mặc định chỉ lỗi `flagged`.
  - Mỗi dòng: id, ngày, nguồn (`manual-fix` hoặc `ai-self-fix`), loại lỗi, file, số dòng thêm và bỏ, và đầu prompt.
  - Tuỳ chọn: `--status <flagged|confirmed|dismissed|all>`, `--source <manual-fix|ai-self-fix>`, `--limit <1-200>` (mặc định 20).
- `nightowl review show <id>`: in đầy đủ một lỗi: file, commit, nguồn, loại và lý do phân loại, prompt, prompt phản hồi (nếu có), và diff giữa bản AI và bản cuối.
- `nightowl review confirm <id...>`: đánh dấu là lỗi thật.
- `nightowl review dismiss <id...>`: đánh dấu là nhiễu. Lỗi bị loại khỏi `report` và `export`, như hiện nay.
- `nightowl review reset <id...>`: trả về `flagged`.

Quy tắc chung:
- Đổi trạng thái là một giao dịch: chỉ cần một id không tồn tại hay không hợp lệ thì không lỗi nào bị đổi, và lệnh thoát mã 1.
- `list` và `show` chỉ đọc. Không có `.nightowl/` thì báo chạy `nightowl init`, không tạo gì.
- Mọi nội dung lấy từ repo (đường dẫn, prompt, code) được lọc ký tự điều khiển trước khi in.
- Không gửi gì ra ngoài máy, không gọi LLM.
- `report` thêm một dòng đếm theo trạng thái (đã xem hay chưa), để biết còn bao nhiêu lỗi chờ xem.

Ngoài phạm vi:
- Chế độ tương tác (hỏi từng lỗi một, bấm phím để chọn).
- Ghi chú lý do khi `dismiss`.
- `export` chỉ lấy lỗi `confirmed`.
- Sửa loại lỗi bằng tay.

## Capabilities

### New Capabilities

- `failure-review`: xem và đánh dấu trạng thái bản ghi lỗi.

### Modified Capabilities

- `cli`: đăng ký lệnh `review`.
- `failure-report`: đếm theo trạng thái xem lại.

## Impact

- Code:
  - `src/commands/review.ts`: lệnh mới, chia lệnh con.
  - `src/review/`: định dạng danh sách và chi tiết.
  - `src/storage/failures.ts`: truy vấn danh sách, chi tiết và đổi trạng thái.
  - `src/report/`: đếm theo trạng thái.
- Dùng lại `unifiedDiff` (đang dùng cho `classify`) để in diff.
- Không đổi schema, không thêm dependency.

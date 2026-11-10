# Proposal

## Why

`nightowl review` hiện yêu cầu gõ id từng lệnh (`list` → `show` → `confirm`/`dismiss`). Duyệt nhiều failure flagged chậm và dễ lệch ngữ cảnh. Cần chế độ tương tác bàn phím để duyệt/đánh dấu nhanh ngay trong terminal, vẫn 100% local và không thêm dependency.

## What Changes

- Thêm chế độ tương tác `nightowl review -i` / `--interactive` (chỉ khi stdin+stdout là TTY): danh sách failure, điều hướng ↑/↓ (và j/k nếu hợp lý), Enter/Space xem diff, `c` confirm, `d` dismiss, `r` reset, `q` thoát.
- Tái dùng bộ lọc list hiện có (`--status`, `--source`, `--agent`, `--limit`) khi vào TUI; sau mỗi mark, danh sách/refresh trạng thái cập nhật.
- Diff trong TUI tô màu `+`/`-` bằng ANSI; vẫn sanitize control chars như review hiện tại (không để ESC “lạ” từ nội dung file phá vỡ UI — chỉ dùng escape do NightOwl phát).
- Không TTY / pipe: báo rõ dùng lệnh không tương tác; không treo.
- Zero runtime dependencies; không LLM; không gửi dữ liệu ra mạng.

## Capabilities

### New Capabilities

- `review-tui`: chế độ TUI bàn phím cho `nightowl review` (điều hướng, xem diff, đánh dấu trạng thái)

### Modified Capabilities

- `failure-review`: bổ sung entry tương tác và ràng buộc TTY / an toàn in
- `cli`: help của `review` nêu `-i` / `--interactive` và phím tắt

## Impact

- Mở rộng `src/commands/review.ts` + module `src/review/tui/` (hoặc tương đương); tái dùng query/format/diff hiện có.
- README: mục review interactive.
- Không đổi schema SQLite; không đụng hook.

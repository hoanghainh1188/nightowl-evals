# review-tui Specification

## Purpose

Cho phép duyệt và đánh dấu failure NightOwl bằng bàn phím trong terminal (TTY), nhanh hơn so với gõ id từng lệnh, vẫn chỉ đọc/ghi local và không thêm dependency ngoài.

## Requirements

### Requirement: Vào chế độ interactive khi có cờ và TTY
`nightowl review -i` hoặc `nightowl review --interactive` SHALL mở phiên tương tác khi cả stdin và stdout là TTY. Khi không phải TTY, lệnh SHALL NOT vào raw mode; SHALL báo trên stderr và thoát mã khác 0.

#### Scenario: Chạy trong TTY
- **WHEN** chạy `nightowl review -i` trong terminal TTY với store đã init
- **THEN** hiển thị danh sách failure tương tác và chờ phím; mã thoát 0 khi thoát bình thường bằng `q`

#### Scenario: Không phải TTY
- **WHEN** chạy `nightowl review -i` với stdin hoặc stdout không phải TTY
- **THEN** stderr giải thích cần terminal tương tác; không treo; thoát mã khác 0

### Requirement: Điều hướng và xem diff bằng phím
Trong phiên TUI, ↑/↓ SHALL đổi mục đang chọn trong danh sách đang lọc. Enter hoặc Space SHALL mở (hoặc đóng) phần xem trước diff của failure đang chọn. Diff SHALL tô màu dòng thêm/bớt bằng ANSI do NightOwl phát; nội dung từ DB SHALL được sanitize trước khi in.

#### Scenario: Duyệt và mở diff
- **WHEN** có ≥2 failure trong list và người dùng nhấn ↓ rồi Space
- **THEN** lựa chọn chuyển xuống mục tiếp theo và vùng preview hiện diff của mục đó

### Requirement: Đánh dấu trạng thái trong TUI
Phím `c` SHALL confirm, `d` SHALL dismiss, `r` SHALL reset failure đang chọn (cùng nghĩa lệnh `confirm`/`dismiss`/`reset`). Sau khi đánh dấu thành công, TUI SHALL cập nhật trạng thái hiển thị (và có thể bỏ mục khỏi list nếu không còn khớp bộ lọc).

#### Scenario: Confirm từ TUI
- **WHEN** đang chọn failure `flagged` và nhấn `c`
- **THEN** failure đó thành `confirmed` trong store và UI phản ánh thay đổi

### Requirement: Thoát và phục hồi terminal
Phím `q` SHALL thoát phiên TUI. Lệnh SHALL khôi phục chế độ terminal (tắt raw mode / con trỏ) trước khi thoát, kể cả khi lỗi giữa chừng nếu có thể.

#### Scenario: Thoát bằng q
- **WHEN** người dùng nhấn `q`
- **THEN** TUI kết thúc, terminal dùng được bình thường, mã thoát 0

### Requirement: Tôn trọng bộ lọc list
TUI SHALL áp dụng cùng bộ lọc list được truyền kèm cờ (`--status`, `--source`, `--agent`, `--limit`) khi tải danh sách ban đầu. `--json` SHALL NOT kết hợp với `-i` (báo lỗi usage).

#### Scenario: Lọc agent trong TUI
- **WHEN** chạy `nightowl review -i --agent cursor`
- **THEN** danh sách TUI chỉ gồm failure agent `cursor` (theo filter hiện có)

#### Scenario: Cấm -i với --json
- **WHEN** chạy `nightowl review -i --json`
- **THEN** stderr báo xung đột tuỳ chọn; thoát mã khác 0; không vào TUI

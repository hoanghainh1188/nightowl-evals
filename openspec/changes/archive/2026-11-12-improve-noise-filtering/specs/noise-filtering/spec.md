# Spec Delta

## Purpose

Chấm điểm và lọc nhiễu local cho bản ghi lỗi AI (heuristic deterministic + học từ review trên máy), rồi hiển thị ước lượng nhiễu để team tin số liệu hơn mà không gửi dữ liệu ra ngoài.

## ADDED Requirements

### Requirement: Chấm điểm nhiễu deterministic
Khi NightOwl tạo bản ghi `failures` từ post-commit, hệ thống SHALL tính `noise_score` trong [0, 1] và danh sách `noise_reasons` từ so sánh nội dung AI với bản commit (và tín hiệu học local nếu có). Scoring SHALL NOT gọi LLM hay mạng. Reason codes SHALL là tập đóng đã document (ví dụ `whitespace`, `comment-only`, `format-only`, `learned-dismiss`).

#### Scenario: Comment-only được gắn reason
- **WHEN** bản AI và bản commit chỉ khác dòng comment (cùng ngôn ngữ file phổ biến đã hỗ trợ) rồi post-commit tạo/gắn failure
- **THEN** failure có `noise_reasons` chứa `comment-only` và `noise_score` ≥ ngưỡng đã document cho mẫu đó

### Requirement: Auto-dismiss mẫu nhiễu an toàn
Với các reason thuộc tập **safe auto-noise** đã document (ít nhất gồm tương đương whitespace đã bỏ qua trước đây và `comment-only`), NightOwl SHALL không để failure ở trạng thái `flagged` đếm như lỗi thường: hoặc không tạo failure, hoặc tạo với status `dismissed` và reason auto-noise rõ ràng. Mẫu không nằm trong tập safe SHALL vẫn `flagged` (có thể kèm score thấp/trung bình).

#### Scenario: Comment-only không làm tăng flagged count
- **WHEN** chỉ có thay đổi comment-only đủ điều kiện safe auto-noise rồi chạy post-commit và `nightowl report`
- **THEN** tổng lỗi không dismissed không tăng vì thay đổi đó (dismissed hoặc không tạo), và vẫn có thể quan sát được tín hiệu auto-noise trong store/report noise section

### Requirement: Học từ review local
Khi `nightowl review dismiss` hoặc `confirm` thành công, NightOwl SHALL cập nhật thống kê học local trong database dự án (đếm theo reason/fingerprint đã chốt). Dismiss SHALL tăng tín hiệu nhiễu; confirm SHALL giảm hoặc trung hoà tín hiệu đó. Dữ liệu học SHALL NOT rời máy.

#### Scenario: Dismiss lặp tăng điểm learned
- **WHEN** user dismiss nhiều failure cùng `noise_reasons` rồi một failure mới cùng reason được chấm
- **THEN** `noise_score` của failure mới không thấp hơn trước khi có chuỗi dismiss đó (với cùng nội dung so sánh), trong giới hạn trần đã document

### Requirement: Ước lượng nhiễu cho báo cáo
Capability báo cáo / dashboard tiêu thụ noise SHALL nhận được chỉ số ước lượng nhiễu trong cửa sổ thời gian: ít nhất (a) tỷ lệ `dismissed / (dismissed + confirmed)` khi mẫu đủ, và (b) số hoặc tỷ lệ failure auto-noise. Khi chưa đủ dữ liệu review, chỉ số SHALL là `n/a` hoặc tương đương, không bịa 0% giả.

#### Scenario: Chưa có confirm/dismiss
- **WHEN** cửa sổ chỉ có `flagged` và không có `confirmed`/`dismissed`
- **THEN** tỷ lệ nhiễu từ review hiển thị n/a (hoặc không có %), không phải 0% bịa

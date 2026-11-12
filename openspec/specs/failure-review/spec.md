# failure-review Specification

## Purpose
`nightowl review` cho dev xem lại các bản ghi lỗi và đánh dấu lỗi thật (`confirmed`) hay nhiễu (`dismissed`), để báo cáo và bộ test chỉ còn lỗi đáng tin, mà không gửi gì ra ngoài máy.

## Requirements

### Requirement: Liệt kê lỗi để xem lại
`nightowl review` (hoặc `nightowl review list`) SHALL in mỗi lỗi một dòng (mới nhất trước), mặc định chỉ lỗi `flagged` và tối đa 20 lỗi. Tuỳ chọn `--status`, `--source` và `--limit` (1–200) thay đổi phần được lọc. Với cờ `--json`, stdout SHALL là một mảng JSON chứa các bản ghi lỗi phù hợp bộ lọc thay vì in bảng văn bản. Lệnh SHALL chỉ đọc.

#### Scenario: Mặc định chỉ lỗi chưa xem
- **WHEN** có 3 lỗi `flagged` và 1 lỗi `dismissed`, rồi chạy `nightowl review`
- **THEN** stdout có đúng 3 dòng lỗi, lỗi mới nhất đứng đầu, và một dòng cuối nêu cách xem chi tiết

#### Scenario: Lọc theo trạng thái và nguồn
- **WHEN** chạy `nightowl review --status all --source ai-self-fix`
- **THEN** chỉ có các lỗi nguồn `ai-self-fix`, ở mọi trạng thái

#### Scenario: Chưa có lỗi
- **WHEN** không có lỗi nào khớp bộ lọc
- **THEN** stdout báo không có lỗi nào và mã thoát là 0

#### Scenario: Xuất danh sách dạng JSON
- **WHEN** có các bản ghi lỗi và chạy `nightowl review --json`
- **THEN** stdout là một mảng JSON hợp lệ chứa các bản ghi lỗi phù hợp bộ lọc, mã thoát 0

### Requirement: Xem chi tiết một lỗi
`nightowl review show <id>` SHALL in file, commit, nguồn, trạng thái, loại lỗi kèm lý do và độ tin cậy nếu có, prompt, prompt phản hồi nếu có, và diff từ bản AI tới bản cuối (tối đa 200 dòng). Với cờ `--json`, stdout SHALL là một đối tượng JSON đầy đủ chứa toàn bộ chi tiết của bản ghi lỗi (kèm `prompt`, `ai_patch`, `dev_patch`, `reason`, `diff`). Lệnh SHALL chỉ đọc.

#### Scenario: Lỗi AI tự sửa
- **WHEN** chạy `nightowl review show 12` với lỗi `ai-self-fix` có prompt phản hồi
- **THEN** stdout có prompt, prompt phản hồi, và diff có dòng bắt đầu bằng `-` cho bản AI và `+` cho bản cuối

#### Scenario: Id không tồn tại
- **WHEN** chạy `nightowl review show 999` mà không có lỗi #999
- **THEN** stderr nêu `#999`, stdout rỗng, mã thoát là 1

#### Scenario: Xem chi tiết dạng JSON
- **WHEN** chạy `nightowl review show 12 --json` với lỗi #12 tồn tại
- **THEN** stdout là một đối tượng JSON hợp lệ chứa thông tin chi tiết của lỗi #12, mã thoát 0

### Requirement: Đánh dấu trạng thái lỗi
`nightowl review confirm|dismiss|reset <id...>` SHALL đổi trạng thái các lỗi đã nêu thành `confirmed`, `dismissed` hoặc `flagged`, trong một giao dịch. Nếu có id không tồn tại hoặc không hợp lệ, lệnh SHALL NOT đổi lỗi nào, SHALL nêu các id đó ra stderr, và thoát mã 1. Id có thể viết `12` hoặc `#12`.

#### Scenario: Loại hai lỗi
- **WHEN** chạy `nightowl review dismiss 11 12`
- **THEN** hai lỗi có trạng thái `dismissed`, stdout báo đã loại 2 lỗi, và `nightowl report` không còn tính chúng

#### Scenario: Một id sai
- **WHEN** chạy `nightowl review confirm 11 999` mà không có lỗi #999
- **THEN** lỗi #11 không đổi trạng thái, stderr nêu `#999`, mã thoát là 1

#### Scenario: Trả về chưa xem
- **WHEN** lỗi #11 đang `dismissed` và chạy `nightowl review reset 11`
- **THEN** lỗi #11 có trạng thái `flagged` và lại được tính trong `report`

### Requirement: An toàn khi xem lại
`nightowl review` SHALL NOT tạo `.nightowl/` hay database khi chúng chưa có, và SHALL NOT nâng cấp schema; trong cả hai trường hợp, lệnh báo chạy `nightowl init` và thoát mã 1. Mọi nội dung lấy từ repo hay database SHALL được bỏ ký tự điều khiển và ký tự đảo chiều chữ trước khi in, trừ tab. Lệnh SHALL NOT gửi dữ liệu ra ngoài máy.

#### Scenario: Repo chưa cài
- **WHEN** chạy `nightowl review` trong repo git chưa chạy `nightowl init`
- **THEN** stderr gợi ý `nightowl init`, mã thoát là 1, và `.nightowl/` không được tạo

#### Scenario: Code có mã escape
- **WHEN** bản AI của một lỗi có ký tự ESC (`\u001b`), rồi chạy `nightowl review show` cho lỗi đó
- **THEN** stdout không chứa ký tự ESC

### Requirement: Filter review theo agent
`nightowl review` SHALL hỗ trợ `--agent <id>` (lặp được) để liệt kê failure theo agent.

#### Scenario: review --agent cursor
- **WHEN** có failure `cursor` và `claude-code`
- **THEN** `nightowl review --agent cursor` chỉ hiện failure `cursor`

### Requirement: Entry interactive cho review
`nightowl review` SHALL chấp nhận cờ `-i` / `--interactive` để vào chế độ TUI mô tả trong capability `review-tui`. Khi không có cờ đó, hành vi list/show/mark hiện tại SHALL không đổi.

#### Scenario: Không -i thì giữ CLI cũ
- **WHEN** chạy `nightowl review` không `-i`
- **THEN** in list văn bản như trước (không raw mode)

### Requirement: Cập nhật học nhiễu khi đánh dấu
Sau khi `nightowl review confirm|dismiss|reset` đổi status thành công, NightOwl SHALL cập nhật bảng/thống kê học nhiễu local gắn với failure đó (reason codes / fingerprint đã chốt). `reset` về `flagged` SHALL hoàn tác hoặc trung hoà đóng góp học của lần mark trước trong phạm vi đã document. Lệnh vẫn SHALL NOT gửi dữ liệu ra ngoài máy.

#### Scenario: Dismiss ghi học local
- **WHEN** dismiss một failure có `noise_reasons` gồm `comment-only`
- **THEN** thống kê học local tăng đếm dismiss cho reason đó và lệnh thoát 0

### Requirement: Review list kèm cluster key
`nightowl review` (list text và `--json`) SHALL kèm `cluster_key` (hoặc tương đương đã document) cho mỗi failure khi tính được. Lệnh SHALL hỗ trợ lọc theo cluster (ví dụ `--cluster <key>`) để chỉ hiện failure thuộc key đó. Interactive TUI MAY dùng cùng filter nếu đã có `-i`; không bắt buộc đổi toàn bộ UX TUI trong change này nếu list CLI đã đủ.

#### Scenario: Lọc theo cluster
- **WHEN** có failure thuộc cluster key `K` và chạy `nightowl review --cluster K`
- **THEN** list chỉ gồm failure có cluster key `K` (sau các filter status/source/agent khác)

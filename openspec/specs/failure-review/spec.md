# failure-review Specification

## Purpose
`nightowl review` cho dev xem lại các bản ghi lỗi và đánh dấu lỗi thật (`confirmed`) hay nhiễu (`dismissed`), để báo cáo và bộ test chỉ còn lỗi đáng tin, mà không gửi gì ra ngoài máy.

## Requirements

### Requirement: Liệt kê lỗi để xem lại
`nightowl review` (hoặc `nightowl review list`) SHALL in mỗi lỗi một dòng, mới nhất trước, gồm id, ngày, nguồn, loại lỗi, file, số dòng thêm và bỏ, và đầu prompt. Mặc định chỉ lỗi `flagged` và tối đa 20 lỗi. Tuỳ chọn `--status`, `--source` và `--limit` (1–200) thay đổi phần được liệt kê. Lệnh SHALL chỉ đọc.

#### Scenario: Mặc định chỉ lỗi chưa xem
- **WHEN** có 3 lỗi `flagged` và 1 lỗi `dismissed`, rồi chạy `nightowl review`
- **THEN** stdout có đúng 3 dòng lỗi, lỗi mới nhất đứng đầu, và một dòng cuối nêu cách xem chi tiết

#### Scenario: Lọc theo trạng thái và nguồn
- **WHEN** chạy `nightowl review --status all --source ai-self-fix`
- **THEN** chỉ có các lỗi nguồn `ai-self-fix`, ở mọi trạng thái

#### Scenario: Chưa có lỗi
- **WHEN** không có lỗi nào khớp bộ lọc
- **THEN** stdout báo không có lỗi nào và mã thoát là 0

### Requirement: Xem chi tiết một lỗi
`nightowl review show <id>` SHALL in file, commit, nguồn, trạng thái, loại lỗi kèm lý do và độ tin cậy nếu có, prompt, prompt phản hồi nếu có, và diff từ bản AI tới bản cuối (tối đa 200 dòng). Lệnh SHALL chỉ đọc.

#### Scenario: Lỗi AI tự sửa
- **WHEN** chạy `nightowl review show 12` với lỗi `ai-self-fix` có prompt phản hồi
- **THEN** stdout có prompt, prompt phản hồi, và diff có dòng bắt đầu bằng `-` cho bản AI và `+` cho bản cuối

#### Scenario: Id không tồn tại
- **WHEN** chạy `nightowl review show 999` mà không có lỗi #999
- **THEN** stderr nêu `#999`, stdout rỗng, mã thoát là 1

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

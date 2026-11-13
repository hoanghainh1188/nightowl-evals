# Spec Delta

## ADDED Requirements

### Requirement: Prune báo ước lượng bytes snapshot
`nightowl prune` (kể cả `--dry-run`) SHALL báo số snapshot bị (hoặc sẽ) dọn **và** ước lượng tổng bytes của nội dung `snapshot` trong payload trước khi null hóa. Ước lượng SHALL dựa trên độ dài chuỗi snapshot lưu trong DB (không bắt buộc bằng delta file sau VACUUM). Failures SHALL vẫn được bảo toàn.

#### Scenario: Dry-run kèm bytes
- **WHEN** chạy `nightowl prune --dry-run` với ≥1 snapshot cũ hơn ngưỡng
- **THEN** stdout gồm số snapshot và ước lượng bytes; database không đổi

#### Scenario: Prune thật kèm bytes
- **WHEN** chạy `nightowl prune` (không dry-run) và có snapshot bị prune
- **THEN** stdout gồm số snapshot đã prune và ước lượng bytes đã bỏ khỏi payload

### Requirement: Retention profile cho prune
`nightowl prune` SHALL chấp nhận retention profile đặt tên đã document (ít nhất map sang số ngày cố định, ví dụ short/default/long). Profile SHALL đặt ngưỡng ngày tương đương `--days`. Kết hợp profile + `--days` SHALL theo quy tắc đã document (reject hoặc ưu tiên một phía) với lỗi rõ nếu reject. Không truyền profile vẫn mặc định 30 ngày như hiện tại.

#### Scenario: Profile đặt ngưỡng ngày
- **WHEN** chạy `nightowl prune --profile short` (hoặc tên đã document map 7 ngày)
- **THEN** chỉ snapshot cũ hơn ngưỡng của profile bị (hoặc sẽ) prune

#### Scenario: Profile không hợp lệ
- **WHEN** chạy `nightowl prune --profile nope`
- **THEN** stderr lỗi rõ; thoát mã 1; DB không đổi

### Requirement: Tóm tắt dung lượng sau vacuum
Khi `nightowl prune --vacuum` chạy prune thật rồi VACUUM, lệnh SHALL báo dung lượng file database local trước và sau VACUUM (bytes; MAY kèm delta). `--dry-run` với `--vacuum` SHALL NOT thực thi VACUUM (cảnh báo hoặc bỏ qua vacuum theo design đã document).

#### Scenario: Vacuum báo trước/sau
- **WHEN** chạy `nightowl prune --vacuum` trên store hiện có
- **THEN** stdout nêu kích thước DB trước và sau VACUUM (hoặc tương đương đã document)

#### Scenario: Dry-run không vacuum
- **WHEN** chạy `nightowl prune --dry-run --vacuum`
- **THEN** không chạy VACUUM; DB không đổi kích thước vì vacuum
